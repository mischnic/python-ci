import os, datetime, github

TOKEN = os.environ.get('TOKEN', "")
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

def getCommitDetails(repoOrCommit, ref=None):
	if ref is None:
		git_commit = repoOrCommit
	else:
		git_commit = getCommit(repoOrCommit, ref)

	commit = git_commit.commit
	committer = git_commit.committer
	return {
		"author": {
			"name": committer.name,
			"avatar_url": committer.avatar_url
		},
		"ref": ref if ref else commit.sha,
		"msg": commit.message,
		"date": unix_time_millis(commit.committer.date),
		"url": commit.html_url
	}

def getCommitDiff(repo, last, curr):
	commits = list()
	for c in getRepo(repo).get_commits(sha=curr):
		if c.sha == last:
			break
		else:
			commits.append(c)
	return commits

def setStatus(repo, ref, status, url, desc = github.GithubObject.NotSet):
	desc = github.GithubObject.NotSet if desc is None else desc
	getCommit(repo, ref).create_status(status, target_url=url, description=desc, context="py-ci")
