# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

from dateutil.parser import parse
from odoo import http, fields
from odoo.addons.project_git.controller.controller import GitController, Parser


class GitHubParser(Parser):

    def __init__(self, data):
        Parser.__init__(self, 'github', data)

    def get_repository_owner_data(self):
        return {
            "name": self.data["sender"]["login"],
            "username": self.data["sender"]["login"].lower(),
            "uuid": self.data["sender"]["id"],
            "avatar": self.data["sender"]["avatar_url"],
            "url": self.data["sender"]["html_url"],
        }

    def get_repository_data(self):
        return {
            "name": self.data["repository"]["name"],
            "uuid": self.data["repository"]["id"],
            "url": self.data["repository"]["html_url"],
        }

    def get_pushes(self):
        return [self.data]

    def get_branch_data(self, push):
        return {
            "name": push["ref"] and push["ref"].rsplit('/', 1)[-1] or "None",
            "url": push["compare"]
        }

    def get_commits(self, push):
        return push["commits"]

    def get_commit_author_data(self, commit):
        return {
            'username': commit["author"]["name"].lower(),
            'email': commit["author"]["email"].lower(),
        }

    def get_commit_data(self, commit):
        return {
            "name": commit["id"][:8],
            "message": commit["message"],
            "url": commit["url"],
            "date": fields.Datetime.to_string(parse(commit["timestamp"]))
        }


class GitLabController(GitController):
    @http.route(['/github/sync'], type='json', auth='public', website=True)
    def store_github_commit(self, *args, **kw):
        return self.store_commit(GitHubParser(http.request.jsonrequest))




