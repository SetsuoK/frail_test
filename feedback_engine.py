
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Any
import pandas as pd
import re

KCL_THRESHOLDS = {
    "総合点": {"正常": (0, 3), "注意": (4, 7), "改善要": (8, 25)},
    "20項目": {"正常": (0, 4), "注意": (5, 9), "改善要": (10, 20)},
    "IADL": {"正常": (0, 0), "注意": (1, 2), "改善要": (3, 5)},
    "運動器": {"正常": (0, 0), "注意": (1, 2), "改善要": (3, 5)},
    "低栄養": {"正常": (0, 0), "注意": (1, 1), "改善要": (2, 2)},
    "口腔":   {"正常": (0, 0), "注意": (1, 1), "改善要": (2, 3)},
    "閉じこもり": {"正常": (0, 0), "注意": (1, 1), "改善要": (2, 2)},
    "認知":   {"正常": (0, 0), "注意": (1, 1), "改善要": (2, 3)},
    "抑うつ": {"正常": (0, 0), "注意": (1, 1), "改善要": (2, 5)},
}
DOMAIN_PRIORITY = {
    "KCL_低栄養": 3,
    "KCL_運動器": 3,
    "KCL_口腔": 2,
    "KCL_認知": 2,
    "KCL_閉じこもり": 2,
    "KCL_IADL(日常生活関連動作)": 1,
    "KCL_抑うつ": 1,
}
MAX_DOMAIN_SNIPPETS = 3
SEVERITY_ORDER = {"RED": 2, "YELLOW": 1}

def alias_metric(mt: str, repo_df) -> str:
    mts = set(repo_df["metric_type"].astype(str).str.strip().unique())

    ALIASES = {
        # --- KCL ---
        "KCL_総合点": ["KCL_総合点", "KCL_総合"],
        "KCL_20項目": ["KCL_20項目", "KCL_20", "KCL20項目"],
        "KCL_IADL(日常生活関連動作)": ["KCL_IADL(日常生活関連動作)", "KCL_IADL"],
        "KCL_低栄養": ["KCL_低栄養", "KCL_栄養"],
        "KCL_抑うつ": ["KCL_抑うつ", "KCL_うつ"],
        # 必要に応じて追加

        # --- KHQ（念のため）---
        # 例: KHQ_Q5, KHQ5, Q5, KHQ_Q05 などを相互吸収
    }

    # 明示エントリがあれば候補から実在を選ぶ
    for c in ALIASES.get(mt, [mt]):
        if c in mts:
            return c

    # ここに来たら KHQパターンのゆれを吸収（数字末尾を拾う）
    import re
    m = re.fullmatch(r"(?:KHQ_?Q)?0?(\d+)", mt.replace(" ", ""))
    if m:
        n = int(m.group(1))
        for c in (f"KHQ_Q{n}", f"KHQ{n}", f"Q{n}", f"KHQ_Q{n:02d}"):
            if c in mts:
                return c

    return mt

def _normalize_khq_flags(khq_raw: Dict[Any, Any]) -> Dict[int, bool]:
    """
    JSXから来た KHQ フラグ（例: "LQ-HEALTH", "KCL-12", "HB-008" など）を
    Python側の想定（intキー）に正規化する。
    末尾の連番を拾い、bool化して返す（拾えないキーは無視）。
    """
    out: Dict[int, bool] = {}
    for k, v in (khq_raw or {}).items():
        if not v:
            continue
        m = re.search(r'(\d+)$', str(k))
        if not m:
            continue
        idx = int(m.group(1))
        out[idx] = bool(v)
    return out

@dataclass
class AssessmentInput:
    age_group: str
    sex: str
    kcl_items: Dict[int, int]
    khq_items: Dict[int, bool]

def _range_to_level(value: int, band: Dict[str, tuple]) -> str:
    for level, (lo, hi) in band.items():
        if lo <= value <= hi:
            return level
    return "注意"

def score_kcl(kcl: Dict[int, int]) -> Dict[str, int]:
    total_25 = sum(kcl.get(i, 0) for i in range(1, 26))
    total_20 = sum(kcl.get(i, 0) for i in range(1, 21))
    iadl = sum(kcl.get(i, 0) for i in range(1, 6))
    undou = sum(kcl.get(i, 0) for i in range(6, 11))
    eiyou = sum(kcl.get(i, 0) for i in (11, 12))
    kouku = sum(kcl.get(i, 0) for i in (13, 14, 15))
    hikikomo = sum(kcl.get(i, 0) for i in (16, 17))
    ninchi = sum(kcl.get(i, 0) for i in (18, 19, 20))
    utsu = sum(kcl.get(i, 0) for i in range(21, 26))
    return {"総合点":total_25,"20項目":total_20,"IADL":iadl,"運動器":undou,"低栄養":eiyou,"口腔":kouku,"閉じこもり":hikikomo,"認知":ninchi,"抑うつ":utsu}

def level_kcl(k: Dict[str, int], kcl_items: Dict[int, int]) -> Dict[str, str]:
    lv = {
        "KCL_総合点": _range_to_level(k["総合点"], KCL_THRESHOLDS["総合点"]),
        "KCL_20項目": _range_to_level(k["20項目"], KCL_THRESHOLDS["20項目"]),
        "KCL_IADL(日常生活関連動作)": _range_to_level(k["IADL"], KCL_THRESHOLDS["IADL"]),
        "KCL_運動器": _range_to_level(k["運動器"], KCL_THRESHOLDS["運動器"]),
        "KCL_低栄養": _range_to_level(k["低栄養"], KCL_THRESHOLDS["低栄養"]),
        "KCL_口腔": _range_to_level(k["口腔"], KCL_THRESHOLDS["口腔"]),
        "KCL_閉じこもり": _range_to_level(k["閉じこもり"], KCL_THRESHOLDS["閉じこもり"]),
        "KCL_認知": _range_to_level(k["認知"], KCL_THRESHOLDS["認知"]),
        "KCL_抑うつ": _range_to_level(k["抑うつ"], KCL_THRESHOLDS["抑うつ"]),
    }
    if kcl_items.get(16,0)==1:
        lv["KCL_閉じこもり"]="改善要"
    elif kcl_items.get(17,0)==1 and lv["KCL_閉じこもり"]=="正常":
        lv["KCL_閉じこもり"]="注意"
    return lv

def pick_top_domains(lv_kcl: Dict[str,str], k_scores: Dict[str,int]) -> List[str]:
    cands = []
    for mt, level in lv_kcl.items():
        if mt.startswith("KCL_") and mt not in {"KCL_総合点","KCL_20項目"}:
            if level != "正常":
                pr = DOMAIN_PRIORITY.get(mt, 0)
                strength = {"注意":1, "改善要":2}.get(level, 0)
                val = k_scores.get(mt.replace("KCL_",""), 0)
                cands.append((mt, pr, strength, val))
    cands.sort(key=lambda x: (x[1], x[2], x[3]), reverse=True)
    return [mt for (mt,_,_,_) in cands[:MAX_DOMAIN_SNIPPETS]]

@dataclass
class SafetyRule:
    rule_id: str
    source: str
    condition: str
    severity: str
    message: str

def load_safety_rules(csv_path: str) -> List[SafetyRule]:
    df = pd.read_csv(csv_path)
    return [SafetyRule(str(r['rule_id']), str(r['source']), str(r['condition']), str(r['severity']).upper(), str(r['message'])) for _, r in df.iterrows()]

def _sum_range_kcl(kcl: Dict[int, int], start: int, end: int) -> int:
    return sum(int(kcl.get(i, 0)) for i in range(start, end+1))

def _all_range_kcl(kcl: Dict[int, int], start: int, end: int) -> bool:
    return all(int(kcl.get(i, 0)) == 1 for i in range(start, end+1))

def _eval_atomic(expr: str, kcl: Dict[int, int], khq: Dict[int, bool], extras: Dict[str, Any]) -> bool:
    expr = expr.strip()
    m = re.fullmatch(r"KCL(\d+)\.\.(\d+)\s*全て\s*=\s*1", expr)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        return _all_range_kcl(kcl, a, b)
    m = re.fullmatch(r"sum\(KCL(\d+)\.\.KCL(\d+)\)\s*([>=<]=?)\s*(\d+)", expr)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        op, val = m.group(3), int(m.group(4))
        s = _sum_range_kcl(kcl, a, b)
        if op == ">=": return s >= val
        if op == "<=": return s <= val
        if op == ">":  return s > val
        if op == "<":  return s < val
        if op == "==": return s == val
        return False
    m = re.fullmatch(r"\(?\s*((?:KCL\d+\s*\+\s*)*KCL\d+)\s*\)?\s*([>=<]=?|==)\s*(\d+)", expr)
    if m:
        items = [int(x.strip()[3:]) for x in m.group(1).split("+")]
        s = sum(int(kcl.get(i, 0)) for i in items)
        op, val = m.group(2), int(m.group(3))
        if op == ">=": return s >= val
        if op == "<=": return s <= val
        if op == ">":  return s > val
        if op == "<":  return s < val
        if op == "==": return s == val
        return False
    m = re.fullmatch(r"KCL(\d+)\s*==\s*(\d+)", expr)
    if m:
        i, v = int(m.group(1)), int(m.group(2))
        return int(kcl.get(i, 0)) == v
    m = re.fullmatch(r"KHQ(\d+)\s*==\s*(True|False)", expr, flags=re.IGNORECASE)
    if m:
        i, v = int(m.group(1)), m.group(2).lower() == "true"
        return bool(khq.get(i, False)) == v
    m = re.fullmatch(r"KHQ(\d+)\s*>=\s*(\d+)falls", expr, flags=re.IGNORECASE)
    if m:
        i, v = int(m.group(1)), int(m.group(2))
        count = int(extras.get(f"khq{i}_falls_count", 0))
        return count >= v
    return False

def _eval_condition(cond: str, kcl: Dict[int, int], khq: Dict[int, bool], extras: Dict[str, Any]) -> bool:
    parts = [p.strip() for p in cond.split(" OR ")]
    return any(_eval_atomic(p, kcl, khq, extras) for p in parts)

def evaluate_safety_flags(kcl: Dict[int, int], khq: Dict[int, bool], rules: List[SafetyRule], extras: Optional[Dict[str, Any]] = None):
    extras = extras or {}
    hits = []
    max_sev_val = 0
    max_sev = None
    for r in rules:
        try:
            ok = _eval_condition(r.condition, kcl, khq, extras)
        except Exception:
            ok = False
        if ok:
            hits.append({"rule_id": r.rule_id, "severity": r.severity, "message": r.message})
            sv = SEVERITY_ORDER.get(r.severity.upper(), 0)
            if sv > max_sev_val:
                max_sev_val = sv
                max_sev = r.severity.upper()
    return hits, max_sev

class TemplateRepo:
    def __init__(self, csv_path: str):
        df = pd.read_csv(csv_path)
        # print(df.head())
        # print('-----------------------------------')
        # print(df.columns)

        for col in ["metric_type","age_group","risk_level","sex","feedback_text"]:
            if col not in df.columns:
                raise ValueError(f"{csv_path}: 必須列 {col} がありません")
        self.df = df

    # def get_text(self, metric_type: str, age_group: str, risk_level: str, sex: str) -> Optional[str]:
    #     q = self.df[(self.df.metric_type==metric_type)&(self.df.age_group==age_group)&(self.df.risk_level==risk_level)&(self.df.sex==sex)]

    #     if not q.empty:
    #         txt = str(q.iloc[0]["feedback_text"] or "").strip()
    #         if txt: return txt

    #     q2 = self.df[(self.df.metric_type==metric_type)&(self.df.age_group==age_group)&(self.df.risk_level==risk_level)&(self.df.sex.isin(["共通","any","男女共通"]))]
    #     print(q2)    
    #     if not q2.empty:
    #         txt = str(q2.iloc[0]["feedback_text"] or "").strip()
    #         if txt: return txt
    #     return None
    def get_text(self, metric_type: str, age_group: str, risk_level: str, sex: str):
        import math
        # import pandas as pd
    
        # --- 補助: 正規化 ---
        def _norm_sex(x) -> str:
            if x is None or (isinstance(x, float) and math.isnan(x)): return "共通"
            s = str(x).strip().lower()
            m = {
                "": "共通", "-": "共通", "*": "共通", "any": "共通", "both": "共通", "男女共通": "共通", "共通": "共通",
                "male": "男性", "m": "男性", "♂": "男性", "男": "男性", "男性": "男性",
                "female": "女性", "f": "女性", "♀": "女性", "女": "女性", "女性": "女性",
            }
            return m.get(s, "共通")
    
        def _norm_age(x) -> str:
            if x is None or (isinstance(x, float) and math.isnan(x)): return "共通"
            return str(x).strip()
    
        # # --- 前処理 ---
        # df = self.df.copy()
        # for c in ["metric_type", "age_group", "risk_level", "sex", "feedback_text"]:
        #     if c in df.columns:
        #         df[c] = df[c].astype(str).str.strip()
        # df["sex_norm"] = df["sex"].apply(_norm_sex) if "sex" in df.columns else "共通"
        # df["age_norm"] = df["age_group"].apply(_norm_age) if "age_group" in df.columns else "共通"
    
        # sex_norm = _norm_sex(sex)
        # if sex_norm not in ("男性", "女性", "共通"):
        #     sex_norm = "共通"
        # age_norm = _norm_age(age_group)
    
        # # 優先順位: ①age一致×sex一致 → ②age一致×sex共通 → ③age共通×sex一致 → ④age共通×sex共通
        # candidates = [
        #     (age_norm, sex_norm),
        #     (age_norm, "共通"),
        #     ("共通", sex_norm),
        #     ("共通", "共通"),
        # ]
        # --- 前処理 ---
        df = self.df.copy()
        for c in ["metric_type", "age_group", "risk_level", "sex", "feedback_text"]:
            if c in df.columns:
                df[c] = df[c].astype(str).str.strip()
        df["sex_norm"] = df["sex"].apply(_norm_sex) if "sex" in df.columns else "共通"
        df["age_norm"] = df["age_group"].apply(_norm_age) if "age_group" in df.columns else "共通"
        
        sex_norm = _norm_sex(sex)
        if sex_norm not in ("男性", "女性", "共通"):
            sex_norm = "共通"
        age_norm = _norm_age(age_group)
        
        # テンプレに実在する値だけを候補に採用
        avail_sex = set(df["sex_norm"].dropna().unique().tolist())
        avail_age = set(df["age_norm"].dropna().unique().tolist())
        
        # sex="共通" のときは 男女→共通 の順で試す。そうでなければ 自身→共通。
        sex_pref = ["男性", "女性", "共通"] if sex_norm == "共通" else [sex_norm, "共通"]
        sex_candidates = [s for s in sex_pref if s in avail_sex]
        
        # ageは 自身→共通 の順
        age_pref = [age_norm, "共通"]
        age_candidates = [a for a in age_pref if a in avail_age]
        
        # 優先順位: まず age一致 を全sex候補で → 次に age共通 を全sex候補で
        candidates = []
        for a in age_candidates:
            for s in sex_candidates:
                pair = (a, s)
                if pair not in candidates:
                    candidates.append(pair)

    
        for a, s in candidates:
            q = df[
                (df["metric_type"] == metric_type) &
                (df["risk_level"] == risk_level) &
                (df["age_norm"] == a) &
                (df["sex_norm"] == s)
            ]
            if not q.empty:
                txt = str(q.iloc[0]["feedback_text"] or "").strip()
                if txt:
                    return txt
    
        return None


def build_feedback(
    age_group: str,
    sex: str,
    kcl_items: Dict[int, int],
    khq_items: Dict[int, bool],
    csv_kcl_templates: str,
    csv_khq_templates: str,
    csv_safety_flags: str,
    extras: Optional[Dict[str, Any]] = None
) -> str:

        # --- ここで受け取れたかをまず可視化 ---
    try:
        print("[PY] age_group:", age_group)
        print("[PY] sex:", sex)
        print("[PY] kcl_items(sample):", dict(list(kcl_items.items())[:8]))
        print("[PY] khq_items(raw):", khq_items)
        print("[PY] extras:", extras)
    except Exception as e:
        print("[PY] debug print error:", e)

    # --- KHQキーの正規化（文字ID→末尾の連番に）---
    khq_items = _normalize_khq_flags(khq_items)
    print("[PY] khq_items(normalized int keys):", khq_items)
    ##########################################
    
    safety_rules = load_safety_rules(csv_safety_flags)
    hits, _ = evaluate_safety_flags(kcl_items, khq_items, safety_rules, extras=extras or {})
    safety_head = ""
    if hits:
        hits_sorted = sorted(hits, key=lambda h: SEVERITY_ORDER[h["severity"]], reverse=True)
        seen = set(); messages=[]
        for h in hits_sorted:
            if h["message"] not in seen:
                seen.add(h["message"])
                prefix = "【至急】" if h["severity"]=="RED" else "【注意】"
                messages.append(prefix + h["message"])
        safety_head = " ".join(messages)

    k_scores = score_kcl(kcl_items)
    def _lv(name): return _range_to_level(k_scores[name], KCL_THRESHOLDS[name])
    lv_kcl = {
        "KCL_総合点": _lv("総合点"),
        "KCL_20項目": _lv("20項目"),
        "KCL_IADL(日常生活関連動作)": _lv("IADL"),
        "KCL_運動器": _lv("運動器"),
        "KCL_低栄養": _lv("低栄養"),
        "KCL_口腔": _lv("口腔"),
        "KCL_閉じこもり": _lv("閉じこもり"),
        "KCL_認知": _lv("認知"),
        "KCL_抑うつ": _lv("抑うつ"),
    }
    if kcl_items.get(16,0)==1:
        lv_kcl["KCL_閉じこもり"]="改善要"
    elif kcl_items.get(17,0)==1 and lv_kcl["KCL_閉じこもり"]=="正常":
        lv_kcl["KCL_閉じこもり"]="注意"

    kcl_repo = TemplateRepo(csv_kcl_templates)
    khq_repo = TemplateRepo(csv_khq_templates)

    parts: List[str] = []
    if safety_head:
        parts.append(safety_head)

    # def alias_metric(mt: str, repo_df) -> str:
    #     if mt in set(repo_df["metric_type"].unique()):
    #         return mt
    #     return {"KCL_総合点": "KCL_総合"}.get(mt, mt)
    
    mt_overall = alias_metric("KCL_総合点", kcl_repo.df)
    t = kcl_repo.get_text(mt_overall, age_group, lv_kcl["KCL_総合点"], sex)
    # t = kcl_repo.get_text("KCL_総合点", age_group, lv_kcl["KCL_総合点"], sex)
    
    if t:
        parts.append(t.replace("{KCL総合点}", str(k_scores["総合点"])))

    mt20 = alias_metric("KCL_20項目", kcl_repo.df)
    t20 = kcl_repo.get_text(mt20, age_group, lv_kcl["KCL_20項目"], sex)
    # t20 = kcl_repo.get_text("KCL_20項目", age_group, lv_kcl["KCL_20項目"], sex)
    if t20:
        parts.append(t20.replace("{KCL20項目}", str(k_scores["20項目"])))

    for mt in pick_top_domains(lv_kcl, k_scores):
        mt_alias = alias_metric(mt, kcl_repo.df)
        tt = kcl_repo.get_text(mt_alias, age_group, lv_kcl[mt], sex)
        # tt = kcl_repo.get_text(mt, age_group, lv_kcl[mt], sex)
        if tt:
            parts.append(tt)


    for qi, val in sorted(khq_items.items()):
        if not val:
            continue
        mt = alias_metric(f"KHQ_Q{qi}", khq_repo.df)
        for lvl in ("改善要","注意","正常"):
            tt = khq_repo.get_text(mt, age_group, lvl, sex)
            if tt:
                parts.append(tt)
                break

    foot = kcl_repo.get_text("SUMMARY_FOOTER", age_group, "注意", sex)
    if foot:
        parts.append(foot)

    return "\n\n".join(p.strip() for p in parts if p and p.strip())
