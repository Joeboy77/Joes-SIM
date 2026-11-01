#!/usr/bin/env bash
# Runs the RISC-V test programs through RARS and compares their output with Joe's SIM's expected
# results (packages/engine/src/reference/riscv/expected.json).
#
# Usage: RARS_JAR=/path/to/rars1_6.jar scripts/check-rars.sh
# You need Java and a RARS jar (https://github.com/TheThirdOne/rars/releases). The jar is not
# stored in this repository.
set -euo pipefail
: "${RARS_JAR:?Set RARS_JAR to the path of a RARS jar, for example rars1_6.jar}"
dir="$(cd "$(dirname "$0")/.." && pwd)/packages/engine/src/reference/riscv"
python3 - "$dir" "$RARS_JAR" <<'PY'
import json, subprocess, sys, pathlib, re
folder, jar = pathlib.Path(sys.argv[1]), sys.argv[2]
expected = json.loads((folder / "expected.json").read_text())
failed = 0
for name, want in expected.items():
    stdin = "".join(f"{v}\n" for v in want["inputs"])
    run = subprocess.run(
        ["java", "-jar", jar, "nc", "me", str(folder / name)],
        input=stdin, capture_output=True, text=True, timeout=60,
    )
    # RARS adds a closing line such as "-- program is finished running (0) --".
    out = re.sub(r"\n*-- program is finished running.*--\s*$", "", run.stdout, flags=re.S)
    ok = out == want["output"]
    failed += not ok
    print(f"{'ok  ' if ok else 'DIFF'} {name}" + ("" if ok else f": RARS {out!r}, expected {want['output']!r}"))
print(f"\n{len(expected) - failed} of {len(expected)} programs match RARS.")
sys.exit(1 if failed else 0)
PY
