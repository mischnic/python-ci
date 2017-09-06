import os, datetime, github

TOKEN = os.environ['TOKEN']
gu = github.Github(TOKEN).get_user()

cache = dict()

epoch = datetime.datetime.utcfromtimestamp(0)

def unix_time_millis(dt):
	return (dt - epoch).total_seconds() * 1000.0

def getRepo(name):
	if not name in cache:
		cache[name] = dict()
		cache[name]["repository"] = gu.get_repo(name)
	return cache[name]["repository"]

def getCommit(repo, ref):
	getRepo(repo)
	if not ref in cache[repo]:
		cache[repo][ref] = getRepo(repo).get_commit(ref)
	return cache[repo][ref]

def getCommitDetails(repo, refs):
	new = []
	for ref in refs:
		c = getCommit(repo, ref).commit
		new.append(dict(ref= ref, date=unix_time_millis(c.committer.date), url=c.html_url))
	return new

def setStatus(repo, ref, status, url, desc = github.GithubObject.NotSet):
	desc = github.GithubObject.NotSet if desc is None else desc
	getRepo(repo).get_commit(ref).create_status(status, target_url=url, description=desc, context="py-ci")
