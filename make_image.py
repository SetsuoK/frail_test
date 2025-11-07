# make_image.py
from typing import Dict, Any, Optional
import io, base64
import matplotlib
matplotlib.use("Agg")  # 必須: ブラウザ(Pyoidide)での描画用
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm
from matplotlib.patches import Polygon

# ▼▼ 追加：フォント登録と既定設定 ▼▼
try:
    fm.fontManager.addfont("NotoSansJP-Regular.ttf")
    jp_name = fm.FontProperties(fname="NotoSansJP-Regular.ttf").get_name()
    plt.rcParams["font.family"] = jp_name
    plt.rcParams["axes.unicode_minus"] = False  # マイナス記号の文字化け対策
except Exception as e:
    # フォントが見つからない場合でも落とさない
    pass
# ▲▲ 追加ここまで ▲▲

def build_image(
    age_group: str,
    sex: str,
    kcl_items: Dict[int, int],
    khq_items: Dict[str, str],
    csv_kcl_templates: str,
    csv_khq_templates: str,
    csv_safety_flags: str,
    extras: Optional[Dict[str, Any]] = None
) -> str:
    kcl_total = sum(int(v) for v in (kcl_items or {}).values())

    fig, ax = plt.subplots(figsize=(3.2, 2.2), dpi=200)
    ax.set_xlim(0, 10); ax.set_ylim(0, 10); ax.set_aspect('equal')
    ax.set_xticks([]); ax.set_yticks([])
    ax.set_title("サンプル画像", fontsize=9, pad=6)  # ← 日本語OK

    tri = Polygon([[2,2],[5,8],[8,2]], closed=True, fill=True, alpha=0.25, edgecolor="black")
    ax.add_patch(tri)

    # ← 日本語テキストもOKになる
    ax.text(0.5, 9.2, f"年齢区分: {age_group}", fontsize=8, ha="left")
    ax.text(0.5, 8.5, f"性別: {sex}",       fontsize=8, ha="left")
    ax.text(0.5, 7.8, f"KCL合計: {kcl_total}", fontsize=8, ha="left")

    buf = io.BytesIO()
    fig.tight_layout()
    fig.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    data = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{data}"
