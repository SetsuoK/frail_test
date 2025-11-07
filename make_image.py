# make_image.py
from typing import Dict, Any, Optional
import io, base64
import matplotlib
matplotlib.use("Agg")  # 必須: ブラウザ(Pyoidide)での描画用
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon

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
    """
    例示用: 受け取った age_group / sex / KCL合計 などを図版に入れ、
    PNG の data URL (data:image/png;base64,...) を返す。
    """
    # ざっくり KCL合計
    kcl_total = sum(int(v) for v in (kcl_items or {}).values())

    # キャンバス
    fig, ax = plt.subplots(figsize=(3.2, 2.2), dpi=200)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.set_aspect('equal')
    ax.set_xticks([]); ax.set_yticks([])
    ax.set_title("Sample Image", fontsize=8, pad=6)

    # Polygon（適当に三角形）
    tri = Polygon([[2,2],[5,8],[8,2]], closed=True, fill=True, alpha=0.25, edgecolor="black")
    ax.add_patch(tri)

    # テキスト (例: 年齢区分 / 性別 / KCL合計)
    ax.text(0.5, 9.2, f"Age: {age_group}", fontsize=7, ha="left", va="center")
    ax.text(0.5, 8.5, f"Sex: {sex}", fontsize=7, ha="left", va="center")
    ax.text(0.5, 7.8, f"KCL total: {kcl_total}", fontsize=7, ha="left", va="center")

    # PNG をメモリバッファに保存 → base64 → data URL
    buf = io.BytesIO()
    fig.tight_layout()
    fig.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    data = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{data}"
