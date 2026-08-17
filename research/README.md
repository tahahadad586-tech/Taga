# Hypertension Research Report

Professional English-language research report on hypertension, delivered as a Word
document and as a PDF with original figures.

## Deliverables

| File | Description |
| --- | --- |
| `Hypertension_Research_Report.docx` | Word document (A4, cover page, table of contents, running header, page numbers, 5 data tables, 6 figures) |
| `Hypertension_Research_Report.pdf` | PDF export of the same document, 12 pages |
| `figures/` | The six original figures embedded in the report (PNG, 200 dpi) |

## Contents of the report

Executive summary, definitions and blood-pressure classification, global burden and
epidemiology, pathophysiology and risk factors, complications, diagnosis and
measurement technique, lifestyle therapy, drug therapy, special populations and
resistant hypertension, hypertensive crises, prevention and public-health strategy,
conclusion and references.

Sources include the WHO fact sheet and *Global Report on Hypertension* (2023), the
2025 ACC/AHA High Blood Pressure Guideline, the 2024 ESC Guidelines for the management
of elevated blood pressure and hypertension, and the major randomised-trial
meta-analyses cited in the reference list.

## Rebuilding the documents

```bash
pip install python-docx matplotlib
sudo apt-get install -y libreoffice-writer   # used for the DOCX -> PDF export

python make_figures.py     # regenerates figures/
python build_report.py     # writes the .docx and then the .pdf
```

All figures are generated programmatically by `make_figures.py`, so the report
contains only original artwork and no third-party images.
