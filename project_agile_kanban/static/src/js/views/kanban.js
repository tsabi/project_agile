// coding: utf-8
// Copyright 2017 Modoolar <info@modoolar.com>
// License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

odoo.define('project_agile.view.kanban', function (require) {
    "use strict";
    const data = require('project_agile.data');
    const DataServiceFactory = require('project_agile.data_service_factory');
    const task_service = DataServiceFactory.get("project.task", false);
    const AgileViewWidget = require('project_agile.BaseWidgets').AgileViewWidget;
    const AgileModals = require('project_agile.widget.modal');
    const ModelList = require('project_agile.model_list');
    const TaskWidget = require('project_agile.widget.task').TaskWidget;
    const hash_service = require('project_agile.hash_service');
    const pluralize = require('pluralize');
    const web_core = require('web.core');
    const qweb = web_core.qweb;
    const _t = web_core._t;
    const mixins = web_core.mixins;
    const core = require('project_agile.core');
    const AgileToast = require('project_agile.toast');
    const ViewManager = require('project_agile.view_manager');

    var KanbanView = AgileViewWidget.extend({
        title: _t("Kanban"),
        template: "project.agile.view.kanban",
        _name: "BacklogView",
        init(parent, options) {
            this._super(parent, options);

            // Getting board_id from hash and fetch all project_ids from that board in order to create filter for fetching projects
            this.board_id = parseInt(hash_service.get("board"));
            this.task_id = hash_service.get("task") && parseInt(hash_service.get("task"));

            this.taskDataset = data.getDataSet("project.task");

            this.projectsAndBoardReady = this.getProjectsAndBoard(this.board_id);
            this.taskListsReady = this.getTaskLists();

            this.filterQuery = "";
            this.taskWidgetItemMap = new Map();
            this.backlogLength = 10;

            window.data = data;
            window.blv = this;
        },
        removeNavSearch() {
            core.bus.trigger("search:remove");
        },
        getProjectsAndBoard(board_id) {
            let def = $.Deferred();

            $.when(data.getDataSet("project.project")
                    .read_slice(["name", "board_ids", "workflow_id"], {
                        domain: data.cache.get("current_user").then(user => {
                            return [
                                ["board_ids", "in", board_id],
                                ["id", "in", hash_service.get("project") ? [hash_service.get("project")] : user.team_ids[user.team_id].project_ids],
                                ["workflow_id", "!=", false]
                            ];
                        }),
                    }),
                data.cache.get("current_user"))
                .then((res, user) => {
                    this.projects = res;
                    this.project_ids = res.map((project) => project.id);
                    def.resolve();
                });
            let defBoard = data.cache.get("board_data", {id: board_id}).then(board => this.board = board);
            return $.when(def, defBoard);
        },
        getTaskLists() {
            let def = $.Deferred();
            this.projectsAndBoardReady.then(() => {
                let backlogTasksIdsLoaded = data.getDataSet("project.task")
                    .id_search(this.filterQuery, data.xmlidToResId("project_agile.project_task_type_epic").then(epic_type_id => {
                        return [
                            ["type_id", "!=", epic_type_id],
                            ["stage_id", "in", this.board.unmapped_task_stage_ids],
                            ["project_id", "in", this.project_ids],
                            ["wkf_state_type", "!=", "done"]
                        ]
                    }), false, false, "agile_order");

                let defaultKanbanStateTasksLoaded = data.getDataSet("project.task")
                    .id_search(this.filterQuery, data.xmlidToResId("project_agile.project_task_type_epic").then(epic_type_id => {
                        return [
                            ["type_id", "!=", epic_type_id],
                            ["stage_id", "=", this.board.default_kanban_stage_id[0]],
                            ["project_id", "in", this.project_ids],
                            ["wkf_state_type", "!=", "done"]
                        ]
                    }), false, false, "agile_order");

                $.when(backlogTasksIdsLoaded, defaultKanbanStateTasksLoaded).done((backlogTasks, defaultKanbanStateTasks) => {
                    this.backlogTaskIds = backlogTasks;
                    this.defaultKanbanStateTaskIds = defaultKanbanStateTasks;
                    def.resolve();
                });
            });
            return def.promise();
        },
        willStart() {
            return $.when(this._super(), this.taskListsReady, data.cache.get("current_user").then(currentUser => {
                this.currentUser = currentUser;
            }));
        },
        renderElement() {
            this._super();

            this.defaultKanbanStateList = new DefaultKanbanStateList(this, {
                model: "project.task",
                ModelItem: TaskItem,
                name: "defaultKanbanStateList",
                task_ids: this.defaultKanbanStateTaskIds,
                sortable: {group: "backlog"},
                kanbanView: this
            });

            this.backlogTaskList = new BacklogList(this, {
                model: "project.task",
                ModelItem: TaskItem,
                name: "backlog",
                sortable: {group: "backlog"},
                kanbanView: this
            });

            let defaultKanbanStateData = {
                defaultKanbanStateName: this.board.default_kanban_stage_id[1],
                count: "0 issues",
                estimates: {
                    todo: 0,
                    inProgress: 0,
                    done: 0
                }
            };
            this.defaultKanbanStateNode = $(qweb.render("project.agile.default_kanban_state", defaultKanbanStateData).trim());
            this.defaultKanbanStateNode.insertBefore(this.$("#kanban-view .backlog-section-break"));
            this.defaultKanbanStateList.insertBefore(this.$("#default-kanban-state .list-preloader"));

            let backlogData = {
                count: "0 issues",
                estimates: {
                    todo: 0,
                    inProgress: 0,
                    done: 0
                }
            };

            this.backlogNode = $(qweb.render("project.agile.backlog", backlogData).trim());
            this.backlogNode.insertAfter(this.$("#kanban-view .backlog-section-break"));
            this.backlogTaskList.insertBefore(this.$("#backlog-task-list .list-preloader"));
        },
        start() {
            this._is_added_to_DOM.then(() => {
                // TODO: remove this hack
                // showing search only on this view, destroy hides it again
                core.bus.trigger("search:show", input => {
                    this.applyFilter(input.val());
                });
            });
            this.bindEventListeners();
        },
        bindEventListeners() {
            this.$('.tooltipped').tooltip({delay: 50});
            this.$("#add-task").click(() => {
                let defaults = {
                    project: this.projects.find(p => p.id == hash_service.get("project"))
                };
                var newItemModal = new AgileModals.NewItemModal(this, {
                    currentProjectId: parseInt(hash_service.get("project")) || undefined,
                    focus: "name",
                    defaults,
                    beforeHook: task => {
                        // get agile_order from list
                        task.agile_order = this.backlogTaskList.getNewOrder(null, this.backlogTaskList.list.size, "backlog");
                    },
                    afterHook: task => {
                        let destinationTaskList = this.backlogTaskList;
                        let taskWidget = destinationTaskList.addItem(task);
                        taskWidget._is_added_to_DOM.then(() => {
                            $("#kanban-view").scrollToElement(taskWidget.$el);
                            taskWidget.$el.highlight();
                        });
                    }
                });
                newItemModal.appendTo($("body"));
            });

            core.bus.on("project.task:write", this, (id, vals, payload) => {
                this.removeTask(id, true);
                this.addTask(id, payload);
            });
            core.bus.on("project.task:create", this, (id, vals, payload) => {
                this.addTask(id, payload);
            });
            core.bus.on("project.task:unlink", this, (id, payload) => {
                this.removeTask(id, true, payload);
            });
        },
        applyFilter(q) {
            this.filterQuery = q;
            data.getDataSet("project.task")
                .id_search(this.filterQuery, data.xmlidToResId("project_agile.project_task_type_epic").then(epic_type_id => {
                    return [
                        ["type_id", "!=", epic_type_id],
                        ["project_id", "in", this.project_ids],
                        ["wkf_state_type", "!=", "done"]
                    ]
                }), false, false, "agile_order").then(task_ids => {
                this.allFilteredTaskIds = task_ids;
                let all_task_ids = [...this.allTaskIds()];
                let new_task_ids = task_ids.filter(id => !all_task_ids.includes(id));
                Array.prototype.push.apply(this.backlogTaskIds, new_task_ids);
                this.filteredBacklogTaskIds = task_ids.filter(id => this.backlogTaskIds.includes(id));
                this.filteredBacklogTaskIdsSliced = this.filteredBacklogTaskIds.slice(0, this.backlogLength);
                let tasks_to_fetch = new_task_ids.length ? [...new_task_ids, ...this.filteredBacklogTaskIdsSliced] : this.filteredBacklogTaskIdsSliced;

                task_service.getRecords(tasks_to_fetch).then(tasks => {
                    if (new_task_ids.length) {
                        for (let task of tasks) {

                            !this.backlogTaskIds.includes(task.id) && this.backlogTaskIds.push(task.id);

                            // TODO: Ovde proveri da li ide u backlog ili Todo
                        }
                    }
                    this.rerenderWidget();
                });

            });
        },
        getBacklogTaskIds() {
            return this.filteredBacklogTaskIds.slice(0, this.backlogLength)
        },
        rerenderWidget() {
            // Remove all children widgets from
            this.__parentedChildren.forEach(c => c.destroy());
            this.renderElement();
            this.bindEventListeners();
        },
        * allTaskIds() {
            // TODO: Iterate trough all sprints and yield task ids
            // Generate all tasks from backlog list
            for (let id of this.backlogTaskIds) {
                yield id;
            }
        },
        removeTask(id, removeFromCache = false, syncerMeta) {
            let taskWidget = this.taskWidgetItemMap.get(id);
            if (!taskWidget) {
                return false;
            }
            // TODO: If task is in Todo, remove it from todo list, otherwise remove from backlog
            // if (taskWidget.sprint_id) {
            //     let sprint_id = taskWidget.sprint_id[0];
            //     let sprintWidget = this.sprintWidgetsMap.get(sprint_id);
            //     sprintWidget.taskList.removeItem(id);
            // } else {
            this.backlogTaskIds.includes(id) && this.backlogTaskIds.splice(this.backlogTaskIds.indexOf(id), 1);
            this.backlogTaskList.removeItem(id);
            // }
            if (removeFromCache) {
                this.taskWidgetItemMap.delete(id)
            }
            if (syncerMeta) {
                if (syncerMeta.user_id.id !== data.session.uid) {
                    AgileToast.toastTask(syncerMeta.user_id, syncerMeta.data, syncerMeta.method);
                }
            }
            return true;
        },
        addTask(id, syncerMeta) {
            task_service.getRecord(id).then(task => {
                // TODO: If task is in Todo, add it to todo list, otherwise remove from backlog
                // if (task.sprint_id) {
                //     let sprint_id = task.sprint_id[0];
                //     let sprintWidget = this.sprintWidgetsMap.get(sprint_id);
                //     sprintWidget.taskList.addItem(task);
                // } else {
                if (!this.backlogTaskIds.includes(id)) {
                    this.backlogTaskIds.push(task.id);
                    this.backlogTaskList.addItem(task);
                }
                if (syncerMeta) {
                    if (syncerMeta.user_id.id !== data.session.uid) {
                        AgileToast.toastTask(syncerMeta.user_id, task, syncerMeta.method);
                    }
                }
            })
        }
    });


    var TaskItem = ModelList.SimpleTaskItem.extend({
        _name: "TaskItem",
        events: {
            'click': '_onItemClicked',
        },
        init(parent, options) {
            this._super(parent, options);
            this.kanbanView = parent.kanbanView;
        },
        _onItemClicked() {
            this.trigger_up("open_right_side", {WidgetClass: TaskWidget, options: {id: this.record.id, isQuickDetailView: true}});
        },
        start() {
            let thisItem = this;
            if (this.record.user_id[0] == data.session.uid) {
                this.$(".assign-to-me").hide();
            }
            this.$(".task-menu, .dropdown-content a").click(evt => {
                evt.preventDefault();
            });
            this.$(".edit-item").click(() => {
                var newItemModal = new AgileModals.NewItemModal(this, {
                    currentProjectId: this.record.project_id[0],
                    focus: "name",
                    edit: this.record,
                });
                newItemModal.appendTo($("body"));
            });

            this.$(".work-log").click(() => {
                var modal = new AgileModals.WorkLogModal(this, {
                    task: this.record,
                    userId: data.session.uid,
                    afterHook: workLog => {
                        // Here we should update right side widget
                        if (this.kanbanView.rightSideWidget && this.kanbanView.rightSideWidget.id == this.id) {
                            this.kanbanView.rightSideWidget.addWorkLog(workLog);
                        }
                    }
                });
                modal.appendTo($("body"));

            });

            this.$(".add-link").click(() => {
                var modal = new AgileModals.LinkItemModal(this, {
                    task: this.record,
                    task_ids: [...this.kanbanView.allTaskIds()],
                    afterHook: (result) => {
                        // Here we should update right side widget
                        // TODO: implement case when rightsidewidget is related task
                        if (this.kanbanView.rightSideWidget && this.kanbanView.rightSideWidget.id == this.id) {
                            this.kanbanView.rightSideWidget.addLink(result);
                        }
                    }
                });
                modal.appendTo($("body"));

            });

            this.$(".add-comment").click(() => {

                var modal = new AgileModals.CommentItemModal(this, {
                    task: this.record,
                    afterHook: (comment) => {
                        // Here we should update right side widget
                        if (this.kanbanView.rightSideWidget && this.kanbanView.rightSideWidget.id == this.id) {
                            this.kanbanView.rightSideWidget.addComment(comment);
                        }
                    }
                });
                modal.appendTo($("body"));

            });

            !this.task_type.allow_sub_tasks ? this.$(".add-sub-item").hide() :
                this.$(".add-sub-item").click(() => {
                    let kanbanView = this.kanbanView;
                    var newItemModal = new AgileModals.NewItemModal(this, {
                        currentProjectId: this.record.project_id[0],
                        projects: this.kanbanView.projects,
                        parent_id: this.record.id,
                        afterHook: task => {
                            kanbanView.backlogTaskList.addItem(task);

                            if (kanbanView.rightSideWidget && kanbanView.rightSideWidget.id === task.parent_id[0]) {
                                kanbanView.rightSideWidget.addSubTask(task);
                            }
                        }
                    });
                    newItemModal.appendTo($("body"));
                });

            this.$(".assign-to-me").click(() => {
                data.getDataSet("project.task").call('write', [[this.record.id], {'user_id': data.session.uid}]).then(() => {
                    data.cache.get("current_user").then(user => {
                        this.record.user_id = [user.id, user.name];
                        if (this.kanbanView.rightSideWidget && this.kanbanView.rightSideWidget.id === this.record.id) {
                            this.kanbanView.rightSideWidget.setAssignee({id: user.id, name: user.name}, false);
                        }
                        this.rerenderWidget();
                    });
                });
            });
            this.$(".delete").click(() => {
                data.getDataSet("project.task").unlink([this.record.id])
            });
            return this._super();
        },
        addedToDOM() {
            this._super();
            this.$('.dropdown-button').dropdown();
        },
        rerenderWidget() {
            this.renderElement();
            this.start();
            this.addedToDOM();
        },
        set_list(listWidget, order) {
            this._super(listWidget, order);
            // TODO write stage change...
            // this.dataset.write(this.id, {sprint_id: listWidget.id, [this.order_field]: order})
            //     .done(r => console.info(`Agile sprint and order saved for task: ${listWidget.id}, ${order}`))
            //     .fail(r => console.error("Error while saving agile order: ", r));
        }
    });
    TaskItem.sort_by = "agile_order";
    TaskItem.default_fields = ["name", "project_id", "agile_order", 'wkf_state_type'];

    ViewManager.include({
        build_view_registry() {
            this._super();
            this.view_registry.set("kanban", KanbanView);
        },
    });

    var DefaultKanbanStateList = ModelList.ModelList.extend({
        _name: "DefaultKanbanStateList",
        _getNewListWidget(listId) {
            return listId === "default_kanban_stage" ? this.kanbanView.defaultKanbanStateList : this.kanbanView.backlogTaskList;
        },
        loadItems() {
            this.allFilteredTaskIds = this.kanbanView.allFilteredTaskIds !== undefined ?
                this.kanbanView.allFilteredTaskIds.filter(id => this.task_ids.includes(id)) :
                this.task_ids;
            return task_service.getRecords(this.allFilteredTaskIds).then(tasks => this.data = tasks);
        },
        addItem(item) {
            if (this.kanbanView) {
                !this.task_ids.includes(item.id) && this.task_ids.push(item.id);

                let cachedWidget = this.kanbanView.taskWidgetItemMap.get(item.id);
                // Use cached widget if exists on kanban view, or create it and store in cache
                let retVal = this._super(cachedWidget || item);
                cachedWidget || this.kanbanView.taskWidgetItemMap.set(item.id, retVal);

                !this.kanbanView.defaultKanbanStateTaskIds.includes(item.id) && this.kanbanView.defaultKanbanStateTaskIds.push(item.id);
                let defaultKanbanStateNode = this.kanbanView.defaultKanbanStateNode;

                defaultKanbanStateNode.find(".task-count").text((this.list.size || 0) + " " + pluralize("issue", this.list.size));
                return retVal;
            }
        },
        removeItem(id) {
            let retVal = this._super(id);
            let task = this.kanbanView.taskWidgetItemMap.get(id);

            this.task_ids.includes(id) && this.task_ids.splice(this.task_ids.indexOf(id), 1);

            if (this.kanbanView.rightSideWidget && this.kanbanView.rightSideWidget.id === id) {
                this.this.kanbanView.rightSideWidget.destroy(true);
                delete this.kanbanView.rightSideWidget;
            }
            // TODO: Update kanban state list story points and count
            // let wkf_state_class = ".wkf_state_" + task.wkf_state_type;
            // sprintWidget.count[task.wkf_state_type] -= task.story_points;
            // sprintWidget.$(wkf_state_class).text(sprintWidget.count[task.wkf_state_type]);
            // sprintWidget.$(".task-count").text((this.list.size || 0) + " " + pluralize("issue", this.list.size));

            return retVal;
        },
        destroy() {
            this.__parentedChildren.forEach(c => c.setParent(undefined));
            mixins.PropertiesMixin.destroy.call(this);
        }
        ,
    });

    var BacklogList = ModelList.ModelList.extend({
        _name: "BacklogList",
        init(parent, options) {
            this._super(parent, options);
            this.shouldLoadMore = true;
        },
        _getNewListWidget(listId) {
            return listId === "default_kanban_stage" ? this.kanbanView.defaultKanbanStateList : this.kanbanView.backlogTaskList;
        },
        loadItems() {
            if (this.kanbanView) {
                this.task_ids = this.kanbanView.allFilteredTaskIds !== undefined ? this.kanbanView.filteredBacklogTaskIdsSliced : this.kanbanView.backlogTaskIds.slice(0, this.kanbanView.backlogLength);
                return task_service.getRecords(this.task_ids).then(tasks => this.data = tasks);
            } else {
                return $.when()
            }
        },
        loadMoreItems() {
            if (this.kanbanView) {
                this.kanbanView.backlogLength += 10;
                this.task_ids = this.kanbanView.allFilteredTaskIds !== undefined ?
                    this.kanbanView.filteredBacklogTaskIdsSliced = this.kanbanView.filteredBacklogTaskIds.slice(0, this.kanbanView.backlogLength) :
                    this.kanbanView.backlogTaskIds.slice(0, this.kanbanView.backlogLength);
                this.kanbanView.$("#backlog-task-list .list-preloader").show();
                task_service.getRecords(this.task_ids).then(tasks => this.data = tasks).then(tasks => {
                    for (let task of tasks) {
                        if (!this.list.has(task.id)) {
                            this.addItem(task);
                        }
                    }
                    this.kanbanView.$(".list-preloader").hide();
                    this.shouldLoadMore = (this.kanbanView.filteredBacklogTaskIds === undefined ?
                        this.kanbanView.backlogTaskIds.length :
                        this.kanbanView.filteredBacklogTaskIds.length) > this.list.size;

                    /* Because lazy loading backlog items work when you scroll down to bottom of backlog,
                    * we need to manage the case where bottom of backlog is above bottom of window.
                    * In such case, when master list is less then 110% in height, load more items if available
                    */
                    if (this.kanbanView.filteredBacklogTaskIds != undefined) {
                        this.kanbanView.backlogNode.find(".task-count").text((this.list.size || 0) + " of " + this.kanbanView.filteredBacklogTaskIds.length + " " + pluralize("issue", this.kanbanView.filteredBacklogTaskIds.length));
                    }
                    if (this.shouldLoadMore && this.kanbanView && this.kanbanView.$(".master-list").height() / this.kanbanView.$el.height() < 1.1) {
                        this.loadMoreItems();
                    }
                    Waypoint.refreshAll();
                })
            }
        },
        addItem(item) {
            if (this.kanbanView) {
                !this.task_ids.includes(item.id) && this.task_ids.push(item.id);

                let cachedWidget = this.kanbanView.taskWidgetItemMap.get(item.id);
                // Use cached widget if exists on backlog view, or create it and store in cache
                let retVal = this._super(cachedWidget || item);
                cachedWidget || this.kanbanView.taskWidgetItemMap.set(item.id, retVal);

                this.kanbanView.filteredBacklogTaskIds && !this.kanbanView.filteredBacklogTaskIds.includes(item.id) && this.kanbanView.filteredBacklogTaskIds.push(item.id);
                !this.kanbanView.backlogTaskIds.includes(item.id) && this.kanbanView.backlogTaskIds.push(item.id);
                let backlogNode = this.kanbanView.backlogNode;

                let totalTaskCount = this.kanbanView.filteredBacklogTaskIds ? this.kanbanView.filteredBacklogTaskIds.length :
                    this.kanbanView.backlogTaskIds ? this.kanbanView.backlogTaskIds.length : 0;
                backlogNode.find(".task-count").text((this.list.size || 0) + " of " + totalTaskCount + " " + pluralize("issue", totalTaskCount));
                return retVal;
            }
        },
        removeItem(id) {
            let retVal = this._super(id);
            if (this.kanbanView) {
                this.task_ids.includes(id) && this.task_ids.splice(this.task_ids.indexOf(id), 1);

                // Remove task from backlog map of task on kanbanView
                // this.getParent().backlog.delete(id);
                if (this.kanbanView.rightSideWidget && this.kanbanView.rightSideWidget.id === id) {
                    this.kanbanView.rightSideWidget.destroy(true);
                    delete this.kanbanView.rightSideWidget;
                }
                if (this.kanbanView.filteredBacklogTaskIds && this.kanbanView.filteredBacklogTaskIds.includes(id)) {
                    this.kanbanView.filteredBacklogTaskIds.splice(this.kanbanView.filteredBacklogTaskIds.indexOf(id), 1);
                }
                if (this.kanbanView.backlogTaskIds.includes(id)) {
                    this.kanbanView.backlogTaskIds.splice(this.kanbanView.backlogTaskIds.indexOf(id), 1);
                }
                let backlogNode = this.kanbanView.backlogNode;

                let totalTaskCount = this.kanbanView.filteredBacklogTaskIds ? this.kanbanView.filteredBacklogTaskIds.length :
                    this.kanbanView.backlogTaskIds ? this.kanbanView.backlogTaskIds.length : 0;
                backlogNode.find(".task-count").text((this.list.size || 0) + " of " + totalTaskCount + " " + pluralize("issue", totalTaskCount));
            }
            return retVal;
        },
        addedToDOM() {
            this.$el.waypoint({
                handler: (direction) => {
                    if (direction === "down" && this.shouldLoadMore) {
                        console.log("Backlog bottom hit, loading more tasks");
                        this.loadMoreItems();
                    }
                },
                context: "#kanban-view",
                offset: 'bottom-in-view'
            })
        }
    });

    return {
        KanbanView,
        DefaultKanbanStateList,
        BacklogList,
        TaskItem
    };
})
;