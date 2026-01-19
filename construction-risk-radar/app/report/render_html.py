from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape

TEMPLATES_DIR = Path(__file__).parent / "templates"

env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)

def render_weekly_report_html(context: dict) -> str:
    template = env.get_template("weekly_report.html")
    return template.render(**context)

def render_portfolio_report_html(context: dict) -> str:
    template = env.get_template("portfolio_report.html")
    return template.render(**context)