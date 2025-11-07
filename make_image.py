from typing import Dict, Any, Optional
import io, base64
import matplotlib
matplotlib.use("Agg")  # 必須: ブラウザ(Pyodide)での描画用
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm
from matplotlib.patches import Polygon
import numpy as np


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



def z2s(z):

    t = (z+4.0)/9.0 * np.pi/2.0
    return np.sin(t)

def CalcAngles(num,values):
    # 角度を計算
    #経験的に16までなら、そのまま表示でOKだけど。18以上だと、上下のラベルが重なってしまう。
    #18以上の場合、70-110°、250-190°は、ラベルは１つだけにする。
    if num < 18:
        angles = np.linspace(0, 2 * np.pi, num, endpoint=False)
    else:
        #偶数のときは、0°に一ついれて、20°から160°は均一に入れる。
        #180°に１つ入れて、200°から340°までは均一に入れる。
        #奇数のときは、100°に１つ入れない。
        #最後に90°シフトする。
        if num % 2 == 0: #偶数
            half = int(num / 2 - 1) 
            angles = [0]
            angles += np.linspace(np.pi * 20.0 / 180.0, np.pi * 160.0 / 180.0, half, endpoint=True).tolist()
            angles += [np.pi]
            angles += np.linspace(np.pi * 200.0 / 180.0, np.pi * 340.0 / 180.0, half, endpoint=True).tolist()
        else:
            half = int((num + 1) / 2 -1)
            angles = [0]
            angles += np.linspace(np.pi * 20.0 / 180.0, np.pi * 160.0 / 180.0, half, endpoint=True).tolist()
            angles += np.linspace(np.pi * 200.0 / 180.0, np.pi * 340.0 / 180.0, half, endpoint=True).tolist()
        
        #偶数と奇数で分ける。
        angles = np.array(angles)
    #最後に90°シフトする。
    angles = angles + np.pi / 2.0
    angles = [i-2*np.pi if i >= 2*np.pi else i for i in angles.tolist() ]
    
    # Use np.clip to replace values
    stats = np.clip(np.array(values), -3.5, 3.5)
    stats = z2s(stats)
    # グラフを閉じるために最初の値を最後に追加
    stats = np.concatenate((stats, [stats[0]]))
    angles += angles[:1]
    return angles,stats

def DrawRadar(ax,title,angles,labels,stats,baseline):
    # レーダーチャートの背景色を設定
    ax.set_facecolor('deepskyblue')
    
    back_reso = 50
    back_angles = np.linspace(0, 2 * np.pi, back_reso, endpoint=False).tolist()
    back_scale = z2s(np.array([-4.0, -3.0, -2.0, -1.0, 0.0, 1.0, 2.0, 3.0]))
    back_color = ['white', 'pink', 'pink', 'mistyrose', 'white', 'white', 'cyan', 'deepskyblue']
    
    back_angles += back_angles[:1]
    
    # リングの色と透明度を設定
    for i, col in zip(back_scale[::-1], back_color[::-1]):
        ax.add_patch(Polygon(np.vstack((back_angles, np.repeat(i, len(back_angles)))).T, closed=True, color=col, alpha=1))

    # リングの線を描画
    for i in back_scale:
        ax.plot(back_angles, np.repeat(i, len(back_angles)), color='gray', linewidth=1)
        
    # 基準線を描画
    if baseline == True:
        for i in z2s(np.array([0.0])):
            ax.plot(back_angles, np.repeat(i, len(back_angles)), color='green', linewidth=2)
            

    # データのプロット
    ax.plot(angles, stats, color='red', marker='o', linewidth=2)
    ax.fill(angles, stats, color='red', alpha=0.2)
    
    # グラフのタイトルを追加
    ax.set_title(title, va='bottom', pad=50)  # vaは垂直配置、padはタイトルとプロットの間のパディングを増やす
    
    # 軸とグリッドを設定
    ax.set_thetagrids(np.degrees(angles[:-1]), labels)
    
    # ラベルがグラフに重ならないように、ポジションを調整する
    for label, angle in zip(ax.get_xticklabels(), angles):
        cosa = np.cos(angle)
        thred = 0.1
        if cosa < -thred:
            label.set_horizontalalignment('right')
        elif cosa> thred:
            label.set_horizontalalignment('left')
        else:
            label.set_horizontalalignment('center')
    
    ax.set_rgrids(range(-3, 4, 1), labels=[''] * len(range(-3, 4, 1)), angle=0)  # r軸のグリッド線を設定
    ax.set_rmax(z2s(4.0))
    ax.set_rmin(z2s(-4.0))
    
    # 軸ラベルを非表示に
    ax.set_yticklabels([])    

def MakeRadar(title, labels, values, baseline=False, font_size=12):
    # 先に設定済みの Noto を使う（ここで別フォントに上書きしない）
    plt.rcParams['font.size'] = font_size

    num = len(labels)
    angles, stats = CalcAngles(num, values)

    fig, ax = plt.subplots(figsize=(6, 6), subplot_kw=dict(polar=True))
    DrawRadar(ax, title, angles, labels, stats, baseline)
    plt.tight_layout()
    return fig  # ← fig を返す

kclCat = {
    "日常生活動作": [1,2,3,4,5],
    "運動機能": [6,7,8,9,10],
    "低栄養": [11,12],
    "口腔機能": [13,14,15],
    "閉じこもり": [16,17],
    "認知機能": [18,19,20],
    "抑うつ気分": [21,22,23,24,25]
  }


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
       
    # データとカテゴリのラベル
    title = "" #"フレイルチェック"
    # labels = np.array(['カテゴリ1', 'カテゴリ2', 'カテゴリ3', 'カテゴリ4', 'カテゴリ5', 'カテゴリ6', 'カテゴリ7', 'カテゴリ8', 'カテゴリ9'])
    # values = np.array([0.0, 1.9, -1.0, 1, 2.2, 0.5, -1, 1.2, -2])

    MaxS = {}
    Scores = {}
    Suffix = {}
    labels = []
    values = []
    for k in kclCat.keys():
        maxv = len(kclCat[k])
        MaxS[k] = maxv
        Scores[k] = 0
        Suffix[k] = ""
    
        for ind in kclCat[k]:
            v = 0
            if ind in kcl_items.keys():
               v = kcl_items[ind] 
            Scores[k] += v
    
        Suffix[k] = "(" + str(Scores[k]) + "/" + str(MaxS[k]) + ")"
        labels.append(k+Suffix[k])
        #-3が0 +3をＭＡＸ　つまり　6/max * score - 3         
        values.append(6.0/(MaxS[k]) * Scores[k] - 3.0)
        
    fig = MakeRadar(title, labels, values, font_size=14)

    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)

    data = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{data}"
