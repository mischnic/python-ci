import pygit2, re, json, requests, os
from typing import Dict, Any, List; assert Dict, Any


TOKEN = os.environ.get('TOKEN', "")

s = requests.Session()
s.headers.update({"Authorization": "token "+TOKEN})

def githubGET(req: str) -> dict:
	url = 'https://api.github.com'+req
	response = s.get(url).text
	return json.loads(response)

def githubPOST(req: str, data: str) -> dict:
	url = 'https://api.github.com'+req
	response = s.post(url, data=data.encode("utf-8")).text
	return json.loads(response)


def setStatus(proj: str, sha: str, status: str, url: str, desc: str) -> dict:
	return githubPOST("/repos/{id}/statuses/{sha}".format(id=repos[proj]["github"], sha=sha),
		json.dumps({
			"context": "py-ci",
			"state": status,
			"target_url": url,
			"description": desc
		})
	)

repos = dict() #type: Dict[str, Dict[str, Any]]
def getRepo(name: str, dir: str = None) -> pygit2.Repository:
	if not name in repos:
		repo = pygit2.Repository(dir if dir is not None else name)
		repos[name] = {
			"repo": repo,
			"github": re.search(r"github\.com[:\/]([\w-]+\/[\w.-]+)", re.sub(r"\.git$","", repo.remotes["origin"].url)).group(1)
		};
	return repos[name]["repo"]

# avatar_urls = dict()
# def getAvatar(name):	
# 	if not name in avatar_urls:
# 		avatar_urls[name] = githubGET("/users/"+name)["avatar_url"]
# 	return avatar_urls[name]

def getCommitDetails(repo: str, sha: str) -> Dict[str, Any]:
	if isinstance(sha, str):
		commit = getRepo(repo).revparse_single(sha)
	else:
		commit = sha

	return {
		"author_name": commit.author.name,
		# "author_avatar": getAvatar(commit.author.name),
		"ref": commit.hex,
		"msg": commit.message,
		"date": commit.author.time*1000,
		"url": "https://github.com/{id}/commit/{sha}".format(id=repos[repo]["github"], sha=commit.hex),
		"parents": [c.hex for c in commit.parents]
	}

def getCommits(repo_name: str, start: str, end: str = None) -> List[pygit2.Commit]:
	'''Go through the log breadth- and timefirst, doesn't contain start and end'''
	repo = getRepo(repo_name)

	# if start:
	# 	start = repo.revparse_single(start+"~1").oid

	commits = list()
	for commit in repo.walk(start, pygit2.GIT_SORT_TIME | pygit2.GIT_SORT_TOPOLOGICAL):
		if start == commit.hex:
			continue

		if end is not None and end == commit.hex:
			break
		commits.append(getCommitDetails(repo_name, commit))

	return commits
