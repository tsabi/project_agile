// coding: utf-8
// Copyright 2017 Modoolar <info@modoolar.com>
// License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

odoo.define('project_agile_scrum.view.active_sprint', function (require) {
    "use strict";
    var KanbanTable = require('project_agile.view.kanban_table');
    var ViewManager = require('project_agile.view_manager');
    const core = require('web.core');
    const _t = core._t;

    var ActiveSprintView = KanbanTable.TaskKanbanTableView.extend({
        KanbanTable: {KanbanTable: KanbanTable.TaskTable},
        emptyTitle: _t("There is no active sprint currently"),
        emptyTemplate: "project.agile.view.sprint.empty",
        init(parent, options) {
            this._super(parent, options);

            // Getting board_id from hash and fetch all project_ids from that board in order to create filter for fetching projects
            this.boardId = parseInt(hash_service.get("board"));
            this.projectId = parseInt(hash_service.get("project"));

            window.as = this;
        },
        willStart() {
            let options = {};
            if (this.projectId) {
                options.project_id = this.projectId;
            }
            return $.when(this._super(), data.session.rpc(`/agile/web/data/active_sprints/${this.boardId}`, options))
                .then((dummy, r) => {
                    this.data = r;
                    if (this.isEmpty()) {
                        this.template = this.emptyTemplate;
                    }
                });
        },
        isEmpty() {
            return !Object.keys(this.data.active_sprints).length
        },
        getTitle() {
            return this.data.active_sprints[Object.keys(this.data.active_sprints)[0]].name;
        },
        generateKanbanTableOptions() {
            return Object.assign(this._super(), {
                kanbanTableOptionsID: "active_sprint",
            });
        },
    });

    ViewManager.include({
        build_view_registry() {
            this._super();
            this.view_registry.set("sprint", ActiveSprintView);
        },
    });
    return {
        ActiveSprintView
    };
});