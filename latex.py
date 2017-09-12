# -*- coding: utf-8 -*-
import re, subprocess, os

TEXCOUNT_PATH = "TeXcount_3_0_1/texcount.pl"

def parseOutput(data, regex):
	s, s2 = None, None
	if "Subcounts:" in data:
		s, s2 = data.split("Subcounts:\n")
	else:
		s = data

	res = {
		"chapters": []
	}
	for l in re.findall(regex, s, re.U):
		# (sumc, text, headers, outside, headersN, floatsN, mathsI, mathsD) = l
		res["total"] = l

	# print re.search(regex, s, re.U).group(1,2,3,4,5,6)

	if s2:
		for l in re.findall(r"^  ([0-9]+)\+([0-9]+)\+([0-9]+) \(([0-9]+)\/([0-9]+)\/([0-9]+)\/([0-9]+)\) ([\w: äöü]+)", s2, re.U|re.M):
			# (text, headers, captions, headersH, floatsH, inlinesH, displayedH, name) = l
			res["chapters"].append((l[7],) + l[:7])

	return res

def correctLetters(letters, words):
	for k, v in letters.items():
		if k in words:
			if k == "chapters":
				for ci, cv in enumerate(v):
					for cci, ccv in enumerate(cv):
						letters[k][ci][cci] = int(ccv) + int(words[k][ci][cci])
			else:
				for ci, cv in enumerate(v):
					letters[k][ci] = int(cv) + int(words[k][ci])
	# return {k: (v if k not in words else
	# 				(correctLettersB(letters[k], words[k]) if isinstance(v, dict) else
	# 				v+words[k])
	# 			)
	# 		for k, v in letters.items()}


lettersR = r"Sum count: ([0-9]+)\nLetters in text: ([0-9]+)\nLetters in headers: ([0-9]+)\nLetters in captions: ([0-9]+)\nNumber of headers: ([0-9]+)\nNumber of floats/tables/figures: ([0-9]+)\nNumber of math inlines: ([0-9]+)\nNumber of math displayed: ([0-9]+)"
wordsR = r"Sum count: ([0-9]+)\nWords in text: ([0-9]+)\nWords in headers: ([0-9]+)\nWords outside text \(captions, etc\.\): ([0-9]+)\nNumber of headers: ([0-9]+)\nNumber of floats\/tables\/figures: ([0-9]+)\nNumber of math inlines: ([0-9]+)\nNumber of math displayed: ([0-9]+)"

def count(path, buildPath, fileName):
	if not os.path.isfile(path+"/"+fileName):
		return (False, "File not found: '"+path+"/"+fileName+"'")
	cmd = [
		TEXCOUNT_PATH,
			"-merge", "-incbib", "-utf8", "-sum", "-relaxed", "-nocol", "-dir="+path+"/", "-auxdir="+buildPath+"/", path+"/"+fileName
		]

	try:
		wordsOut = subprocess.check_output(cmd)
		if "File not found" in wordsOut:
			raise subprocess.CalledProcessError(1, cmd, wordsOut)
		words = parseOutput(wordsOut, wordsR)
		lettersOut = subprocess.check_output(cmd + ["-chars"])
		letters = parseOutput(lettersOut, lettersR)
		correctLetters(letters, words)
	except (subprocess.CalledProcessError, OSError, ValueError) as exc:
		if type(exc).__name__ == "OSError":
			return (False, str(exc))
		else:
			return (False, exc.output)
	else:
		return (True,{
				"words": words,
				"letters": letters
			})



def copyFolderStructure(src, target):
	for root, subFolders, _ in os.walk(src):
		subFolders[:] = [d for d in subFolders if not d[0] == '.']
		f = "."+root[len(src):]
		try:
			os.mkdir(os.path.join(target, f), 0755)
		except OSError:
			pass


def doCompile(proj, buildPath, fileName):
	lastLog = ""
	successful = True

	copyFolderStructure(proj, buildPath)

	cmd = ["latexmk",
				"-interaction=nonstopmode",
				# "-gg",
				"-file-line-error",
				"-outdir=../"+buildPath,
				"-pdf", fileName+".tex" ]

	try:
		lastLog += ">>> "+(" ".join(cmd))+"\n"
		lastLog += subprocess.check_output(cmd, cwd=proj, stderr=subprocess.STDOUT) + "\n"

	except (subprocess.CalledProcessError, OSError) as exc:
		if type(exc).__name__ == "OSError":
			lastLog += "latexmk failed: "+str(exc.strerror) + "\n"
		else:
			lastLog += exc.output + "\n"
			lastLog += "latexmk failed: "+str(exc.returncode) + "\n"
		successful = False

	return (successful, lastLog)
