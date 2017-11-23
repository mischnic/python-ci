import os, json, errno, subprocess, pwd, platform
from typing import List, Callable, Dict

OUTPUT_SUFFIX = os.environ.get('OUTPUT_SUFFIX', "_build")
CI_PATH = os.environ.get('CI_PATH', None)

def getCmd(cmd: List[str]) -> List[str]:
	if platform.system() == "Darwin":
		return ["/usr/bin/script", "-q", "/dev/null"] + cmd
	else:
		return ["script", "-qec", " ".join(cmd), "/dev/null"]


def runSubprocess(cmd: List[str], out: Callable[[str], None], cwd: str = None, env: Dict[str, str] = {}) -> int:
	try:
		env["CLICOLOR"] = "1"
		env["TERM"] = "xterm-256color"
		env["PATH"] = (CI_PATH+":" if CI_PATH else "") + "/usr/local/bin:/usr/bin:/bin" + (env["PATH"] if "PATH" in env else "")
		env["USER"] = pwd.getpwuid(os.getuid()).pw_name

		process = subprocess.Popen(getCmd(cmd), cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)

		while process.poll() is None:
			line = process.stdout.readline()
			# if not line: break
			out(line.decode("utf-8"))

		while line:
			line = process.stdout.readline()
			if line:
				out(line.decode("utf-8"))
			
		# while True:
		# 	output = process.stdout.readline()
		# 	if output == '' and process.poll() is not None:
		# 		break
		# 	if output:
		# 		print(output.decode("utf-8"))
		# 		out(output.decode("utf-8"))
		process.wait()
		return process.returncode
	except OSError as e:
		out(e.strerror+"\n")
		return 1

def symlink_force(target: str, link_name: str) -> None:
	try:
		os.symlink(target, link_name)
	except OSError as e:
		if e.errno == errno.EEXIST:
			os.remove(link_name)
			os.symlink(target, link_name)
		else:
			raise e

def parseRef(proj: str, ref: str) -> str:
	if ref == "latest":
		return os.path.basename(os.path.realpath(proj+OUTPUT_SUFFIX+"/"+ref))
	else:
		return ref

def loadJSON(fileName: str) -> dict:
	data = None
	try:
		f = open(fileName, "r")
		try:
			data = json.load(f)
		finally:
			f.close()
	except IOError:
		pass
	except ValueError:
		pass

	return data

def getConfig(proj: str, ref: str = None):
	if ref is not None:
		if os.path.exists(getBuildPath(proj, ref)+"/.ci.json"):
			return loadJSON(getBuildPath(proj, ref)+"/.ci.json")

	return loadJSON(getProjPath(proj)+"/.ci.json")

def getProjPath(proj: str) -> str:
	return "../build/"+proj

def getBuildPath(proj: str, ref: str = None) -> str:
	return "../build/"+proj+OUTPUT_SUFFIX + ("" if ref is None else ("/"+ ref))
