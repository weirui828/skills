#!/usr/bin/env bash
# castra audit: report how far the projects under a root folder are from the standard layout.
# Read-only. Usage: audit.sh [root]   (default: current directory)
set -u
root="${1:-.}"
root="$(cd "$root" && pwd)" || exit 1

scratch_names="output outputs artifacts work tmp temp scratch .scratch .review results"
loose_patterns="*report*.md *.log *.tgz *.zip *.tar.gz"

issues_total=0
repos=0
clean=0

say() { printf '  - %s\n' "$1"; n=$((n + 1)); }

echo "castra audit of $root"
echo

echo "[root]"
n=0
[ -f "$root/AGENTS.md" ] || say "no AGENTS.md (shared rules for every project)"
[ -f "$root/CLAUDE.md" ] || say "no CLAUDE.md importing AGENTS.md"
[ -f "$root/MIGRATION.md" ] || say "no MIGRATION.md (record of moved paths)"
[ -f "$root/.agents/memory/INDEX.md" ] || say "no shared memory index at .agents/memory/INDEX.md"
[ "$n" -eq 0 ] && echo "  ok"
issues_total=$((issues_total + n))
echo

not_repos=""
for dir in "$root"/*/; do
  dir="${dir%/}"
  name="$(basename "$dir")"
  if [ ! -e "$dir/.git" ]; then
    not_repos="$not_repos $name"
    continue
  fi
  repos=$((repos + 1))
  n=0
  out=""
  add() { out="$out  - $1"$'\n'; n=$((n + 1)); }
  g() { git -C "$dir" "$@" 2>/dev/null; }

  # agent files
  if [ ! -f "$dir/AGENTS.md" ]; then
    add "no AGENTS.md"
  elif [ -z "$(g ls-files AGENTS.md)" ]; then
    add "AGENTS.md exists but is not tracked"
  fi
  if [ -f "$dir/AGENTS.md" ] && [ ! -f "$dir/CLAUDE.md" ]; then
    add "no CLAUDE.md importing AGENTS.md"
  fi

  # design/ is local-only
  if [ -d "$dir/design" ]; then
    t="$(g ls-files design | wc -l | tr -d ' ')"
    [ "$t" -gt 0 ] && add "design/ has $t tracked files (should be local, via .git/info/exclude)"
    if [ "$t" -eq 0 ] && ! g check-ignore -q design; then
      add "design/ is not excluded (add it to .git/info/exclude)"
    fi
  fi

  # internal material inside docs/
  for sub in design tasks plans research research_notes reports decisions.md questions.md; do
    [ -e "$dir/docs/$sub" ] && add "docs/$sub looks internal (belongs in design/)"
  done

  # secrets
  for f in "$dir"/.env "$dir"/.env.*; do
    [ -f "$f" ] || continue
    b="$(basename "$f")"
    case "$b" in .env.example|.env.sample|.env.template) continue ;; esac
    if [ -n "$(g ls-files "$b")" ]; then
      add "$b is TRACKED (possible secret in history)"
    elif ! g check-ignore -q "$b"; then
      add "$b is not ignored (one 'git add -A' from being committed)"
    fi
  done

  # ignored but still tracked
  t="$(g ls-files -ci --exclude-standard | wc -l | tr -d ' ')"
  [ "$t" -gt 0 ] && add "$t files are ignored but still tracked"

  # scratch folders
  for s in $scratch_names; do
    # only a folder with nothing tracked is scratch; a tracked one is real content
    [ -d "$dir/$s" ] && [ -z "$(g ls-files "$s" | head -1)" ] && add "$s/ should be out/"
  done
  if [ -d "$dir/out" ] && ! g check-ignore -q out; then
    add "out/ is not ignored"
  fi

  # tool folders named in .gitignore instead of the local exclude file
  if [ -f "$dir/.gitignore" ]; then
    for tdir in .claude/worktrees .worktrees; do
      grep -qE "^/?${tdir//./\\.}/?$" "$dir/.gitignore" && add "$tdir is in .gitignore (use .git/info/exclude)"
    done
  fi

  # loose files in the project root
  for p in $loose_patterns; do
    for f in "$dir"/$p; do
      [ -f "$f" ] && add "loose file in root: $(basename "$f")"
    done
  done

  # remote and naming
  url="$(g remote get-url origin)"
  if [ -z "$url" ]; then
    add "no remote (work exists only on this machine)"
  else
    rname="$(basename "$url" .git)"
    [ "$rname" != "$name" ] && add "folder name differs from repository name ($rname)"
  fi
  case "$name" in
    *-[0-9]|*-[0-9].[0-9]*|*-v[0-9]*|*_[0-9]) add "version in folder name (use tags or an archive folder)" ;;
  esac

  if [ "$n" -eq 0 ]; then
    clean=$((clean + 1))
  else
    echo "[$name]"
    printf '%s' "$out"
    echo
    issues_total=$((issues_total + n))
  fi
done

if [ -n "$not_repos" ]; then
  echo "[not git repositories]"
  for x in $not_repos; do echo "  - $x"; done
  echo
fi

echo "$repos repositories, $clean clean, $issues_total findings"
