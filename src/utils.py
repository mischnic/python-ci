import os, json, errno

OUTPUT_SUFFIX = os.environ.get('OUTPUT_SUFFIX', "_build")

def symlink_force(target, link_name):
	try:
		os.symlink(target, link_name)
	except OSError as e:
		if e.errno == errno.EEXIST:
			os.remove(link_name)
			os.symlink(target, link_name)
		else:
			raise e

def parseRef(proj, ref):
	if ref == "latest":
		return os.path.basename(os.path.realpath(proj+OUTPUT_SUFFIX+"/"+ref))
	else:
		return ref

def loadJSON(fileName):
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

def getConfig(proj):
	return loadJSON(getProjPath(proj)+"/.ci.json")

def getProjPath(proj):
	return "../build/"+proj

def getBuildPath(proj, ref = None):
	return "../build/"+proj+OUTPUT_SUFFIX + ("" if ref is None else ("/"+ ref))
