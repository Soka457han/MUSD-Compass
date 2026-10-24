"""pyproject.toml (read by Vercel) must agree with .python-version and requirements.txt (read by CI)."""

import os
import tomllib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(name):
    with open(os.path.join(ROOT, name), encoding="utf-8") as f:
        return f.read()


def test_pyproject_matches_python_version_and_requirements():
    project = tomllib.loads(read("pyproject.toml"))["project"]
    assert project["requires-python"] == f"=={read('.python-version').strip()}.*"
    reqs = [line.strip() for line in read("requirements.txt").splitlines() if line.strip() and not line.startswith("#")]
    assert sorted(project["dependencies"]) == sorted(reqs)
    assert tomllib.loads(read("pyproject.toml"))["tool"]["vercel"]["entrypoint"] == "api.telegram:app"
