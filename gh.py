import os, github


TOKEN = os.environ['TOKEN']
g = github.Github(TOKEN)


def setStatus(repo, ref, status, url, desc = github.GithubObject.NotSet):
	g.get_user().get_repo(repo).get_commit(ref).create_status(status, target_url=url, description=desc, context="py-ci")
