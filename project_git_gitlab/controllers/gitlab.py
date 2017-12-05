# -*- coding: utf-8 -*-
# Copyright 2017 Modoolar <info@modoolar.com>
# License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

import re
from dateutil.parser import parse

from odoo import http, fields
from odoo.addons.project_git.controller.controller import GitController, Parser
from odoo.addons.project_git.utils.utils import urljoin


class GitLabParser(Parser):

    def __init__(self, data):
        Parser.__init__(self, 'gitlab', data)

    def get_repository_owner_data(self):
        utils = re.search('(https?://.+/)(\w+)/.+', self.data['repository']['git_http_url'])
        link = utils.group(1)
        username = utils.group(2)

        return {
            'name': username == self.data['user_username'] and self.data['user_name'] or username.title(),
            'username': username,
            'uuid': username == self.data['user_username'] and self.data['user_id'] or '',
            'avatar': username == self.data['user_username'] and urljoin(link, self.data['user_avatar']),
            'url': urljoin(link, username),
            'email': username == self.data['user_username'] and self.data['user_email'] or ''
        }

    def get_repository_data(self):
        return {
            'name': self.data['project']['name'],
            'full_name': self.data['project']['path_with_namespace'],
            'url': self.data['project']['http_url']
        }

    def get_pushes(self):
        return [self.data]

    def get_branch_data(self, push):
        branch_name = push["ref"].split('/')[-1]
        return {
            "name": branch_name,
            "url": urljoin(push['project']['http_url'], 'tree', branch_name)
        }

    def get_commits(self, push):
        return push["commits"]

    def get_commit_author_data(self, commit):
        author_data = dict(name=commit['author']['name'], email=commit['author']['email'])
        repository_owner = self.get_repository_owner_data()
        return repository_owner if repository_owner['email'] == author_data['email'] else author_data

    def get_commit_data(self, commit):
        return {
            "name": commit["id"][:8],
            "message": commit["message"],
            "url": commit["url"],
            "date": fields.Datetime.to_string(parse(commit["timestamp"]))
        }

    def request_type(self):
        if self.data['after'].isdigit() and not int(self.data['after']):
            return 'delete'
        return 'store'


class GitLabController(GitController):

    @http.route(['/gitlab/sync'], type='json', auth='public', website=True)
    def process_request_gitlab(self, *args, **kw):
        return self.process_request(GitLabParser(http.request.jsonrequest))









