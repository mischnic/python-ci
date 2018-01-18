# -*- coding: utf-8 -*-
import re, subprocess, os
from typing import Callable, Tuple, Union, cast, Dict, Any

from utils import getProjPath, runSubprocess

TEXCOUNT_PATH = "../../TeXcount_3_1/texcount.pl"

def parseOutput(data: str, regex: str) -> Dict[str, Any]:
	s, s2 = None, None
	if "Subcounts:" in data:
		s, s2 = data.split("Subcounts:\n")
	else:
		s = data

	res = {
		"chapters": []
	} #type: dict
	
	for l in re.findall(regex, s, re.U):
		# (sumc, text, headers, outside, headersN, floatsN, mathsI, mathsD) = l
		res["total"] = l

	if s2:
		for l in re.findall(r"^  ([0-9]+)\+([0-9]+)\+([0-9]+) \(([0-9]+)\/([0-9]+)\/([0-9]+)\/([0-9]+)\) ([\w: äöü]+)", s2, re.U|re.M):
			# (text, headers, captions, headersH, floatsH, inlinesH, displayedH, name) = l
			res["chapters"].append((l[7],) + l[:7])

	return res

def correctLetters(letters: dict, words: dict) -> None:
	for k, v in letters.items():
		if k in words:
			if k == "chapters":
				for ci, cv in enumerate(v):
					letters[k][ci] = tuple((int(ccv) + int(words[k][ci][cci]) if not isinstance(ccv, str) else ccv) for cci, ccv in enumerate(cv))
			else:
				letters[k] = tuple(int(cv) + int(words[k][ci]) for ci, cv in enumerate(v))


lettersR = r"Sum count: ([0-9]+)\nLetters in text: ([0-9]+)\nLetters in headers: ([0-9]+)\nLetters in captions: ([0-9]+)\nNumber of headers: ([0-9]+)\nNumber of floats/tables/figures: ([0-9]+)\nNumber of math inlines: ([0-9]+)\nNumber of math displayed: ([0-9]+)"
wordsR = r"Sum count: ([0-9]+)\nWords in text: ([0-9]+)\nWords in headers: ([0-9]+)\nWords outside text \(captions, etc\.\): ([0-9]+)\nNumber of headers: ([0-9]+)\nNumber of floats\/tables\/figures: ([0-9]+)\nNumber of math inlines: ([0-9]+)\nNumber of math displayed: ([0-9]+)"

def count(path: str, buildPath: str, fileName: str) -> Tuple[bool, Union[dict, str]]:
	if not os.path.isfile(path+"/"+fileName):
		return (False, "File not found: '"+path+"/"+fileName+"'")
	cmd = [
		TEXCOUNT_PATH, # "-incbib",
			"-merge",  "-utf8", "-sum", "-relaxed", "-nocol", "-dir="+path+"/", "-auxdir="+buildPath+"/", path+"/"+fileName
		]

	try:
		wordsOut = subprocess.check_output(cmd).decode("utf-8", errors="ignore")
		if "File not found" in wordsOut:
			raise subprocess.CalledProcessError(1, cmd, wordsOut)
		words = parseOutput(wordsOut, wordsR)
		lettersOut = subprocess.check_output(cmd + ["-chars"]).decode("utf-8", errors="ignore")
		letters = parseOutput(lettersOut, lettersR)
		correctLetters(letters, words)
	except (subprocess.CalledProcessError, OSError, ValueError) as exc:
		if type(exc).__name__ == "OSError":
			return (False, str(exc))
		else:
			return (False, cast(subprocess.CalledProcessError, exc).output)
	else:
		return (True,{
				"words": words,
				"letters": letters
			})



def copyFolderStructure(src: str, target: str) -> None:
	for root, subFolders, _ in os.walk(src):
		subFolders[:] = [d for d in subFolders if not d[0] == '.']
		f = "."+root[len(src):]
		try:
			os.mkdir(os.path.join(target, f), 0o755)
		except OSError:
			pass


def doCompile(proj: str, buildPath: str, cfg: dict, log: Callable[[str], None]) -> bool:
	successful = True
	copyFolderStructure(getProjPath(proj), buildPath)
	
	main = cfg.get("main", None)
	if main:
		cmd = ["latexmk",
					"-interaction=nonstopmode",
					# "-gg",
					"-file-line-error",
					"-outdir="+buildPath,
					"-pdf", main+".tex" ]

		env = {
			"max_print_line": "100",
			"error_line": "254",
			"half_error_line": "238"
		}

		log(">>> " + (" ".join(cmd)) + "\n")
		rv = runSubprocess(cmd, log, cwd=getProjPath(proj), env=env)
		if rv != 0:
			log("latexmk failed: "+str(rv) + "\n")
			successful = False
		
	else:
		log("Missing 'main' in config")
		successful = False

	return successful
