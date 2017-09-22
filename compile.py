import subprocess, time, os, json
from threading import Thread
import latex, gh
from utils import symlink_force, getBuildPath, log, getConfig, loadJSON

TOKEN = os.environ.get('TOKEN', "")
DOMAIN = os.environ.get('URL', "")

compileThread = None

#
# STATUS
#

def updateStatus(proj, ref, msg, (start, duration), errorMsg = None, stats = {}):
	if msg == "success":
		color = "#4c1"
	elif msg == "pending":
		color = "darkgrey"
	else:
		color = "red"

	svg = """
	<svg xmlns="http://www.w3.org/2000/svg" width="90" height="20">
		<linearGradient id="a" x2="0" y2="100%">
			<stop offset="0" stop-color="#bbb" stop-opacity=".1" />
			<stop offset="1" stop-opacity=".1" />
		</linearGradient>
		<rect rx="3" width="90" height="20" fill="#555" />
		<rect rx="3" x="37" width="53" height="20" fill="{}" />
		<path fill="{}" d="M37 0h4v20h-4z" />
		<rect rx="3" width="90" height="20" fill="url(#a)" />
		<g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
			<text x="19.5" y="15" fill="#010101" fill-opacity=".3">built</text>
			<text x="19.5" y="14">built</text>
			<text x="62.5" y="15" fill="#010101" fill-opacity=".3">{}</text>
			<text x="62.5" y="14">{}</text>
		</g>
	</svg>""".format(color, color, ref[:7], ref[:7])

	with open(getBuildPath(proj, ref)+"/.status.svg", "w") as f:
		f.write(svg)

	data = {
		"ref": ref,
		"status": msg,
		"errorMsg": errorMsg,
		"start": round(start*1000),
		"duration": duration,
		"stats": stats
	}	

	with open(getBuildPath(proj, ref)+"/.status.json", "w") as f:
		f.write(json.dumps(data))

	if TOKEN:
		gh.setStatus(proj, ref, msg, DOMAIN+"/"+proj+"/"+ref, errorMsg)


#
# COMPILE
#

def getStatus(proj, ref, raw=False):
	if raw:
		return getBuildPath(proj, ref)+"/.status.json"

	return loadJSON(getBuildPath(proj, ref)+"/.status.json")


def updateGit(proj, ref):
	lastLog = ""
	successful = True
	try:
		lastLog += subprocess.check_output(["git", "pull", "origin", "master"], cwd=proj, stderr=subprocess.STDOUT) + "\n"
		lastLog += subprocess.check_output(["git", "reset", "--hard", ref], cwd=proj, stderr=subprocess.STDOUT) + "\n"

	except subprocess.CalledProcessError as exc:
		lastLog += exc.output + "\n"
		lastLog += "git operations failed: "+str(exc.returncode) + "\n"
		successful = False

	return (successful, lastLog)

compileLang = dict(
	latex = latex.doCompile,
	git = lambda a,b,c,d: (True, "")
)


def doCompile(proj, ref):
	timeStart = time.time()
	log(">>> Started: "+time.strftime("%c"))
	lastLog = ">>> Started: "+time.strftime("%c") + "\n"

	if not os.path.exists(getBuildPath(proj, ref)):
		os.makedirs(getBuildPath(proj, ref))
	updateStatus(proj, ref, "pending", (timeStart, None))
	successful = True

	successfulGit, lastLogGit = updateGit(proj, ref)
	lastLog += lastLogGit
	successful = successfulGit

	if successful:
		successfulCfg = True
		cfg = getConfig(proj)
		lang = cfg.get("language", None)
		main = cfg.get("main", None)

		if not lang or not main:
			successfulCfg = False
			successful = successfulCfg

		if successful:
			if not os.path.exists(getBuildPath(proj)):
				print "creating "+getBuildPath(proj)
				os.makedirs(getBuildPath(proj))
			successfulCompile, lastLogCompile = compileLang[lang](proj, getBuildPath(proj, ref), main)
			lastLog += lastLogCompile
			successful = successfulCompile
		else:
			lastLog += "not compiling" + "\n"

	stats = {}
	if successful:
		cfg = getConfig(proj)
		if "stats" in cfg:
			if cfg["language"] == "latex" and "counts" in cfg["stats"]:
				(success, counts) = latex.count(proj, getBuildPath(proj, ref), cfg["main"]+".tex")
				if success:
					stats["counts"] = counts
				else:
					stats["counts"] = False	

	log(">>> Finished "+ref)
	lastLog += ">>> Finished: "+time.strftime("%X")+" "+ref  + "\n"

	with open(getBuildPath(proj, ref)+"/.log", 'w') as lastLogFile:
		lastLogFile.write(lastLog)

	updateStatus(proj, ref, "success" if successful else "error", (timeStart, time.time() - timeStart),
		"Git stage failed" if not successfulGit else
		"Config error" if not successfulCfg else
		"Compile stage failed" if not successfulCompile else None, stats)

	symlink_force(ref, getBuildPath(proj, "latest"))


def startCompile(proj, ref):
	global compileThread
	# pylint: disable=no-member
	if compileThread and compileThread.isAlive():
		return "Currently compiling", 503
	else:
		compileThread =	Thread(target=doCompile, args=(proj, ref))
		compileThread.start()
		return "Compiling Started", 200