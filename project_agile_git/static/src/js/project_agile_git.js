// coding: utf-8
// Copyright 2017 Modoolar <info@modoolar.com>
// License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

odoo.define("project_agile_git", function (require) {

    const TaskWidget = require('project_agile.widget.task').TaskWidget;
    const ModalWidget = require('project_agile.widget.modal').ModalWidget;
    const data = require('project_agile.data');

    TaskWidget.include({
        start() {

            $("#show_commits").click(() => {
                data.getDataSet("project.git.commit").read_slice([], {domain: [["task_ids", "in", [this.id]]]}).then(commits => {
                    var modal = new CommitsModal(this, {commits});
                    modal.appendTo($("body"));
                });

            });

            return this._super();
        }
    });


    const CommitsModal = ModalWidget.extend({
        template: "project.agile.widget.modal.show_commits",
        init(parent, options) {
            this._super(parent, options);
            this._require_prop("commits");
        },
        addedToDOM() {
            this._super();
            this.$('.tooltipped').tooltip();
        }
    });

    return {
        CommitsModal
    }
});