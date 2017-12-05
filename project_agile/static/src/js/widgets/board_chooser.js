// coding: utf-8
// Copyright 2017 Modoolar <info@modoolar.com>
// License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

odoo.define('project_agile.board_chooser', function (require) {
    "use strict";

    var data = require('project_agile.data');
    var ModelList = require('project_agile.model_list');
    var AgileBaseWidget = require('project_agile.BaseWidgets').AgileBaseWidget;
    var storage_service = require('project_agile.storage_service');
    var hash_service = require('project_agile.hash_service');
    var _t = require('web.core')._t;
    var bus = require('project_agile.core').bus;
    var crash_manager = require('web.crash_manager');

    var BoardChooser = AgileBaseWidget.extend({
        _name: "BoardChooser",
        init(parent, options) {
            this._super(parent, options);
            Object.assign(this, options);
            this.current_board = parseInt(hash_service.get("board"));
            this.current_project = parseInt(hash_service.get("project"));
            // Todo: make multiple projects support
            this.prepareData();
        },
        prepareData() {
            if (this.current_project) {
                this.projectLoaded = (() => {
                    var def = $.Deferred();
                    data.getDataSet("project.project")
                        .read_ids([this.current_project], ["name", "image_key", "__last_update"]).then(data => {
                        this.project = data[0];
                        def.resolve();
                    });
                    return def.promise();
                })();
            }
            this.boardListCreated = data.cache.get("current_user").then(user => {
                this.user = user;
                this.boardList = new ModelList.ModelList(this, {
                    model: "project.agile.board",
                    useDataService: true,
                    domain: [["project_ids", "in", this.current_project ? [this.current_project] : user.team_ids[user.team_id].project_ids]],
                    tagName: "ul",
                    id: "board-chooser-dropdown",
                    className: "dropdown-content",
                    itemExtensions: {
                        board_chooser: this,
                    },
                    ModelItem: BoardListItem
                });
            });

        },
        setBoard(id) {
            storage_service.set("board", id);
            let boardTypeChanged = this.board === undefined || this.board.type !== this.boards[id].type;
            if (this.board !== undefined) {
                this.boardList.addItem(this.board);
            }
            this.board = this.boards[id];
            hash_service.setHash("board", id, true, boardTypeChanged);
            if (boardTypeChanged) {
                hash_service.delete("view");
                this.trigger_up("board_type_changed");
            }
            this.$("a.available-boards").html(this.board.name + ' <i class="mdi mdi-menu-down right"></i>')
        },
        willStart() {
            return $.when(this._super(), this.boardListCreated).then(() => {
                return $.when(this.boardList.items_loaded, this.projectLoaded).then((data, user) => {
                    // Extract board id-name map from boardList
                    this.boards = {};
                    if (this.boardList.data.length == 0) {
                        delete this.template;
                        crash_manager.show_error({
                            type: _t("Configuration error"),
                            message: _t("Project ") + this.project.name + _t(" does not have any board associated with it."),
                            data: {debug: ""}
                        });
                        hash_service.setHash("page", "dashboard");
                        return $.Deferred().reject();
                    }
                    for (let board of this.boardList.data) {
                        this.boards[board.id] = board;
                    }

                    // if board from hash_service doesnt exist or not valid, choose first existing board
                    if (!this.boardList.data.find(o => o.id === this.current_board) && this.boardList.data.length > 0) {
                        this.setBoard(this.boardList.data[0].id)
                    } else {
                        // save current board;
                        this.board = this.boards[this.current_board];
                    }
                });
            });
        },
        start() {
            // Materialize Dropdown
            this.boardList._is_added_to_DOM.then(() => {
                $('.dropdown-button').dropdown({
                    inDuration: 300,
                    outDuration: 125,
                    constrain_width: true, // Does not change width of dropdown to that of the activator
                    hover: false, // Activate on click
                    alignment: 'left', // Aligns dropdown to left or right edge (works with constrain_width)
                    gutter: 0, // Spacing from edge
                    belowOrigin: true // Displays dropdown below the button
                });
            });
        },

        renderElement() {
            this._super();
            // Adding backlog task list
            this.boardList.insertAfter(this.$(".available-boards"));
        },

        project_image_url() {
            return this.current_project ?
                data.getImage("project.project", this.current_project, this.project._last_update) :
                data.getImage("project.agile.team", this.user.team_id);
        }
    });
    var BoardListItem = AgileBaseWidget.extend({
        _name: "BoardListItem",
        template: "project.agile.list.board_chooser_item",
        init(parent, options) {
            this._super(parent, options);
            Object.assign(this, options);
            this._require_prop("board_chooser", "Reference to BoardChooser not passed to BoardListItem");
        },
        start() {
            if (this.id == hash_service.get("board")) {
                this.destroy();
            } else {
                // When clicked on project in dashboard, fetch all boards and open last board.
                this.$("a").click(() => {
                    this.selectBoard();
                });
            }
            return this._super();
        },
        selectBoard() {
            this.board_chooser.setBoard(this.record.id);
            this.destroy();
        }
    });
    return {
        BoardChooser,
        BoardListItem
    };
});