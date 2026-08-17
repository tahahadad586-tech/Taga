"""Generate the original figures used in the hypertension research report.

All figures are drawn programmatically with matplotlib so that the report
contains only original artwork (no third-party images).

Usage:
    python make_figures.py [output_directory]
"""

import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

NAVY = "#12365B"
BLUE = "#1F77B4"
TEAL = "#2A9D8F"
AMBER = "#E9A13B"
ORANGE = "#E1701A"
RED = "#C1272D"
GREY = "#6E7B85"
LIGHT = "#EDF2F6"

plt.rcParams.update(
    {
        "font.family": "DejaVu Sans",
        "font.size": 10,
        "axes.edgecolor": GREY,
        "axes.labelcolor": NAVY,
        "text.color": NAVY,
        "xtick.color": NAVY,
        "ytick.color": NAVY,
        "figure.dpi": 200,
    }
)


def _save(fig, path: Path) -> None:
    fig.savefig(path, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"wrote {path}")


def fig_bp_categories(path: Path) -> None:
    """Blood-pressure classification: 2017/2025 ACC/AHA vs 2024 ESC."""
    fig, axes = plt.subplots(1, 2, figsize=(9.4, 4.4))

    acc = [
        ("Normal", "<120 / <80", 100, 120, TEAL),
        ("Elevated", "120-129 / <80", 120, 130, AMBER),
        ("Stage 1 hypertension", "130-139 / 80-89", 130, 140, ORANGE),
        ("Stage 2 hypertension", "≥140 / ≥90", 140, 170, RED),
    ]
    esc = [
        ("Non-elevated BP", "<120 / <70", 100, 120, TEAL),
        ("Elevated BP", "120-139 / 70-89", 120, 140, AMBER),
        ("Hypertension", "≥140 / ≥90", 140, 170, RED),
    ]

    for ax, data, title in (
        (axes[0], acc, "ACC/AHA (2017 categories, retained in 2025)"),
        (axes[1], esc, "ESC 2024"),
    ):
        for label, rng, low, high, colour in data:
            ax.bar(
                0,
                high - low,
                bottom=low,
                width=0.5,
                color=colour,
                edgecolor="white",
                linewidth=1.2,
            )
            mid = (low + high) / 2
            ax.text(
                0.32,
                mid,
                f"{label}\n{rng} mm Hg",
                ha="left",
                va="center",
                fontsize=8.6,
                color=NAVY,
            )
        ax.set_ylim(100, 172)
        ax.set_xlim(-0.35, 1.75)
        ax.set_xticks([])
        ax.set_ylabel("Office systolic blood pressure (mm Hg)")
        ax.set_yticks([100, 110, 120, 130, 140, 150, 160, 170])
        ax.set_title(title, fontsize=10, fontweight="bold", color=NAVY)
        for side in ("top", "right"):
            ax.spines[side].set_visible(False)

    fig.suptitle(
        "Figure 1. Office blood-pressure classification in current guidelines",
        fontsize=12,
        fontweight="bold",
        color=NAVY,
        y=1.03,
    )
    fig.tight_layout()
    _save(fig, path)


def fig_care_cascade(path: Path) -> None:
    """Global hypertension care cascade (WHO, adults aged 30-79 years)."""
    labels = [
        "Living with\nhypertension",
        "Aware of\ndiagnosis",
        "Receiving\ntreatment",
        "Blood pressure\ncontrolled",
    ]
    values = [100, 54, 42, 21]
    colours = [NAVY, BLUE, TEAL, AMBER]

    fig, ax = plt.subplots(figsize=(8.6, 4.0))
    bars = ax.bar(labels, values, color=colours, width=0.58)
    for bar, value in zip(bars, values):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            value + 2.5,
            f"{value}%",
            ha="center",
            fontsize=12,
            fontweight="bold",
        )
    ax.set_ylim(0, 115)
    ax.set_ylabel("Share of adults with hypertension (%)")
    ax.set_title(
        "Figure 2. The global hypertension care cascade\n"
        "(~1.28 billion adults aged 30-79 years; WHO estimates)",
        fontsize=12,
        fontweight="bold",
        color=NAVY,
    )
    ax.grid(axis="y", color=LIGHT, linewidth=1)
    ax.set_axisbelow(True)
    for side in ("top", "right", "left"):
        ax.spines[side].set_visible(False)
    _save(fig, path)


def fig_pathophysiology(path: Path) -> None:
    """Schematic of the determinants of arterial blood pressure."""
    fig, ax = plt.subplots(figsize=(9.2, 4.6))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 6)
    ax.axis("off")

    def box(x, y, w, h, text, colour, fontsize=9.5, textcolour="white"):
        ax.add_patch(
            FancyBboxPatch(
                (x, y),
                w,
                h,
                boxstyle="round,pad=0.08,rounding_size=0.12",
                facecolor=colour,
                edgecolor="white",
                linewidth=1.2,
            )
        )
        ax.text(
            x + w / 2,
            y + h / 2,
            text,
            ha="center",
            va="center",
            fontsize=fontsize,
            color=textcolour,
            fontweight="bold",
        )

    def arrow(x1, y1, x2, y2):
        ax.add_patch(
            FancyArrowPatch(
                (x1, y1),
                (x2, y2),
                arrowstyle="-|>",
                mutation_scale=14,
                linewidth=1.4,
                color=GREY,
            )
        )

    box(3.5, 4.7, 3.0, 0.85, "Blood pressure =\ncardiac output x SVR", NAVY, 10.5)

    box(1.4, 3.1, 2.6, 0.8, "Cardiac output\n(heart rate, stroke volume)", BLUE, 8.6)
    box(6.0, 3.1, 2.6, 0.8, "Systemic vascular\nresistance", BLUE, 8.6)
    arrow(4.4, 4.7, 2.9, 3.95)
    arrow(5.6, 4.7, 7.1, 3.95)

    box(0.2, 1.5, 2.3, 0.85, "Sodium retention\nand volume expansion", TEAL, 8.4)
    box(2.8, 1.5, 2.3, 0.85, "Renin-angiotensin-\naldosterone system", TEAL, 8.4)
    box(5.4, 1.5, 2.3, 0.85, "Sympathetic\nover-activity", TEAL, 8.4)
    box(8.0, 1.5, 1.9, 0.85, "Endothelial\ndysfunction", TEAL, 8.4)

    arrow(2.2, 3.05, 1.6, 2.4)
    arrow(3.0, 3.05, 3.9, 2.4)
    arrow(6.9, 3.05, 6.4, 2.4)
    arrow(7.6, 3.05, 8.7, 2.4)

    box(
        0.2,
        0.15,
        9.7,
        0.85,
        "Underlying drivers: ageing and arterial stiffening | excess dietary sodium | obesity | "
        "physical inactivity\nalcohol | chronic kidney disease | obstructive sleep apnoea | "
        "genetic susceptibility",
        GREY,
        8.2,
    )

    ax.set_title(
        "Figure 3. Determinants and mechanisms of elevated blood pressure",
        fontsize=12,
        fontweight="bold",
        color=NAVY,
        pad=12,
    )
    _save(fig, path)


def fig_target_organ_damage(path: Path) -> None:
    """Hub-and-spoke diagram of hypertension-mediated organ damage."""
    fig, ax = plt.subplots(figsize=(8.6, 4.8))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 5.6)
    ax.axis("off")

    ax.add_patch(
        FancyBboxPatch(
            (3.85, 2.35),
            2.3,
            0.95,
            boxstyle="round,pad=0.1,rounding_size=0.15",
            facecolor=RED,
            edgecolor="white",
        )
    )
    ax.text(
        5.0, 2.83, "Sustained\nhypertension", ha="center", va="center",
        color="white", fontsize=11, fontweight="bold",
    )

    targets = [
        (0.6, 4.3, "Brain", "Stroke, transient ischaemic\nattack, vascular dementia"),
        (6.9, 4.3, "Heart", "Left ventricular hypertrophy,\ncoronary disease, heart failure"),
        (0.6, 0.35, "Kidneys", "Albuminuria, chronic kidney\ndisease, kidney failure"),
        (6.9, 0.35, "Eyes / vessels", "Retinopathy, aortic aneurysm,\nperipheral artery disease"),
    ]
    for x, y, title, detail in targets:
        ax.add_patch(
            FancyBboxPatch(
                (x, y),
                2.5,
                1.05,
                boxstyle="round,pad=0.1,rounding_size=0.15",
                facecolor=LIGHT,
                edgecolor=BLUE,
                linewidth=1.4,
            )
        )
        ax.text(x + 1.25, y + 0.78, title, ha="center", fontsize=10, fontweight="bold", color=NAVY)
        ax.text(x + 1.25, y + 0.33, detail, ha="center", fontsize=8, color=NAVY)

        cx, cy = x + 1.25, y + (0.05 if y > 2.5 else 1.15)
        ax.add_patch(
            FancyArrowPatch(
                (5.0, 2.85 if y > 2.5 else 2.35),
                (cx, cy),
                arrowstyle="-|>",
                mutation_scale=13,
                linewidth=1.4,
                color=GREY,
                shrinkA=6,
                shrinkB=4,
            )
        )

    ax.set_title(
        "Figure 4. Hypertension-mediated organ damage",
        fontsize=12,
        fontweight="bold",
        color=NAVY,
        pad=10,
    )
    _save(fig, path)


def fig_management_pathway(path: Path) -> None:
    """Stepped-care management pathway."""
    fig, ax = plt.subplots(figsize=(9.2, 4.4))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 5.2)
    ax.axis("off")

    steps = [
        (
            "1. Confirm the diagnosis",
            "Standardised office readings plus home or\n24-hour ambulatory monitoring",
            NAVY,
        ),
        (
            "2. Stratify risk and screen",
            "Cardiovascular risk score, organ-damage work-up,\nsecondary causes when indicated",
            BLUE,
        ),
        (
            "3. Lifestyle therapy for all",
            "Sodium reduction, DASH-type diet, weight loss,\nactivity, alcohol reduction, no smoking",
            TEAL,
        ),
        (
            "4. Drug therapy when indicated",
            "Single-pill combination of an ACE inhibitor or ARB\nwith a calcium blocker or thiazide-type diuretic",
            AMBER,
        ),
        (
            "5. Titrate, monitor, sustain",
            "Reassess in 4-8 weeks, add spironolactone for\nresistant disease, support adherence long term",
            ORANGE,
        ),
    ]

    y = 4.4
    for title, detail, colour in steps:
        ax.add_patch(
            FancyBboxPatch(
                (0.4, y - 0.72),
                9.2,
                0.72,
                boxstyle="round,pad=0.04,rounding_size=0.1",
                facecolor=LIGHT,
                edgecolor=colour,
                linewidth=1.6,
            )
        )
        ax.add_patch(
            FancyBboxPatch(
                (0.4, y - 0.72),
                3.1,
                0.72,
                boxstyle="round,pad=0.04,rounding_size=0.1",
                facecolor=colour,
                edgecolor=colour,
            )
        )
        ax.text(1.95, y - 0.36, title, ha="center", va="center", color="white",
                fontsize=9.5, fontweight="bold")
        ax.text(3.75, y - 0.36, detail, ha="left", va="center", color=NAVY, fontsize=8.6)
        if y > 1.4:
            ax.add_patch(
                FancyArrowPatch(
                    (1.95, y - 0.78),
                    (1.95, y - 0.94),
                    arrowstyle="-|>",
                    mutation_scale=12,
                    linewidth=1.4,
                    color=GREY,
                )
            )
        y -= 0.9

    ax.set_title(
        "Figure 5. Stepped-care pathway for the management of hypertension",
        fontsize=12,
        fontweight="bold",
        color=NAVY,
        pad=10,
    )
    _save(fig, path)


def fig_risk_reduction(path: Path) -> None:
    """Illustrative benefit of a 10 mm Hg reduction in systolic pressure."""
    outcomes = ["Major cardiovascular\nevents", "Stroke", "Coronary heart\ndisease", "Heart failure", "All-cause\nmortality"]
    reductions = [20, 27, 17, 28, 13]

    fig, ax = plt.subplots(figsize=(8.6, 4.0))
    bars = ax.barh(outcomes, reductions, color=[NAVY, BLUE, TEAL, AMBER, ORANGE], height=0.55)
    for bar, value in zip(bars, reductions):
        ax.text(value + 0.6, bar.get_y() + bar.get_height() / 2, f"-{value}%",
                va="center", fontsize=11, fontweight="bold")
    ax.set_xlim(0, 34)
    ax.set_xlabel("Approximate relative risk reduction (%)")
    ax.invert_yaxis()
    ax.grid(axis="x", color=LIGHT, linewidth=1)
    ax.set_axisbelow(True)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    ax.set_title(
        "Figure 6. Expected benefit of lowering systolic blood pressure by 10 mm Hg\n"
        "(pooled estimates from large randomised-trial meta-analyses)",
        fontsize=12,
        fontweight="bold",
        color=NAVY,
    )
    _save(fig, path)


def main() -> None:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent / "figures")
    out.mkdir(parents=True, exist_ok=True)
    fig_bp_categories(out / "fig1_bp_categories.png")
    fig_care_cascade(out / "fig2_care_cascade.png")
    fig_pathophysiology(out / "fig3_pathophysiology.png")
    fig_target_organ_damage(out / "fig4_organ_damage.png")
    fig_management_pathway(out / "fig5_management_pathway.png")
    fig_risk_reduction(out / "fig6_risk_reduction.png")


if __name__ == "__main__":
    main()
