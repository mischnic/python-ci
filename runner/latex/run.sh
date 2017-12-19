#!/bin/sh

repo="$1"
ref="$2"
main="$3"
clean="$4"

name="$(echo "$repo" | cut -d'/' -f2)"

ssh -o StrictHostKeyChecking=no -T git@github.com
echo ">>> git clone git@github.com:${repo}.git"
	git -c color.ui=always clone git@github.com:${repo}.git repo || exit 1

	cd repo
echo ">>> git reset --hard $ref"
	git -c color.ui=always reset --hard $ref  || exit 1

echo ">>> git diff --stat ..HEAD~1"
	git -c color.ui=always --no-pager diff --stat HEAD~1 HEAD

out="/build/${name}_build/${ref}"

mkdir -p "${out}"
if [ ! -z ${clean+x} ]; then
	echo ">>> Cleaning for ${ref}..."
	rm -rf $out/*
fi

cp -f .ci.json $out/  || exit 2

echo ">>> Creating latex directories..."
for f in $(find . -type d -not -path '*/\.*' -print); do
	mkdir -p "${out}/${f}"  || exit 3
done

echo ">>> latexmk -interaction=nonstopmode -file-line-error -outdir='$out' -pdf '${main}.tex'"
max_print_line=100 error_line=254 half_error_line=238 \
	latexmk -interaction=nonstopmode -file-line-error -outdir="$out" -pdf "${main}.tex"  || exit 3
