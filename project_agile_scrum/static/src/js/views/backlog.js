// coding: utf-8
// Copyright 2017 Modoolar <info@modoolar.com>
// License LGPLv3.0 or later (https://www.gnu.org/licenses/lgpl-3.0.en.html).

odoo.define('project_agile_scrum.view.backlog', function (require) {
    "use strict";
    const data = require('project_agile.data');
    const DataServiceFactory = require('project_agile.data_service_factory');
    const task_service = DataServiceFactory.get("project.task", false);
    const dialog = require('project_agile.dialog');
    const AgileViewWidget = require('project_agile.BaseWidgets').AgileViewWidget;
    const DataWidget = require('project_agile.BaseWidgets').DataWidget;
    const AgileModals = require('project_agile.widget.modal');
    const ModelList = require('project_agile.model_list');
    const TaskWidget = require('project_agile.widget.task').TaskWidget;
    const hash_service = require('project_agile.hash_service');
    const storage_service = require('project_agile.storage_service');
    const pluralize = require('pluralize');
    const web_core = require('web.core');
    const qweb = web_core.qweb;
    const _t = web_core._t;
    const mixins = web_core.mixins;
    const core = require('project_agile.core');
    const formats = require('web.formats');
    const AgileToast = require('project_agile.toast');
    const Sortable = require('sortable');
    const ViewManager = require('project_agile.view_manager');

    const BacklogView = AgileViewWidget.extend({
        title: _t("Backlog"),
        template: "project.agile.view.backlog",
        _name: "BacklogView",
        custom_events: Object.assign(AgileViewWidget.prototype.custom_events || {}, {
            delete_sprint: function (evt) {
                let sprint = evt.data.sprint;
                dialog.confirm(_t("Delete sprint"), _t("Are you sure you want to delete this sprint?"), _t("yes")).done(() => {
                    sprint.unlink().done(function () {
                        // At this point database doesn't contain record, and we should cleanup widget and remove tasks.
                        let sprintWidget = this.sprintWidgetsMap.get(sprint.id);
                        let backlogListWidget = this.backlogTaskList;
                        // TODO: Move all tasks to backlog when deleting sprint

                        for (let task of sprintWidget.taskList.__parentedChildren.reverse()) {
                            task.set_list(backlogListWidget, backlogListWidget.getNewOrder(null, 0, false));
                        }
                        sprint.destroy();
                        this.sprintWidgetsMap.delete(sprint.id);
                        this.sprintMap.delete(sprint.id);
                        this.renderSprintState();

                    }.bind(this));
                });
            },
            move_sprint_up: function (evt) {
                let sprint = evt.data.sprint;
                let indexOfPrevious = this.__parentedChildren.findIndex(e => e.id == sprint.id) - 1;
                let previousSprint = this.__parentedChildren[indexOfPrevious];
                this.swapSprints(sprint, previousSprint);
            },
            move_sprint_down: function (evt) {
                let sprint = evt.data.sprint;
                let indexOfNext = this.__parentedChildren.findIndex(e => e.id == sprint.id) + 1;
                let nextSprint = this.__parentedChildren[indexOfNext];
                this.swapSprints(nextSprint, sprint);
            },
            start_sprint: function (evt) {
                let sprint = evt.data.sprint;
                dialog.confirm(_t("Start sprint"), _t("Are you sure you want to start this sprint?"), _t("yes")).done(() => {
                    var start_date = moment(new Date()).hours(9).minutes(0).seconds(0);

                    // When loading backlog view we need to load team details as well.
                    // TODO: Here we need to take actual sprint length setting from team level.
                    var end_date = start_date.clone().add(2, 'week');

                    start_date = formats.parse_value(start_date, {"widget": 'datetime'});
                    end_date = formats.parse_value(end_date, {"widget": 'datetime'});

                    data.session.rpc(`/agile/web/data/sprint/${sprint.id}/start`, {start_date: start_date, end_date: end_date})
                        .then(data => {
                            sprint.__model.state = data.state;
                            sprint.__model.start_date = data.start_date;
                            sprint.__model.end_date = data.end_date;
                            console.info(`Sprint ${sprint._model.name} started at: ${data.start_date}, end on: ${data.end_date}`);
                            this.renderSprintState();
                        })
                        .fail((error) => console.error(error));
                });
            },
            end_sprint: function (evt) {
                let sprint = evt.data.sprint;
                dialog.confirm(_t("End sprint"), _t("Are you sure you want to end this sprint?"), _t("yes")).done(() => {
                    data.session.rpc(`/agile/web/data/sprint/${sprint.id}/stop`)
                        .then((data) => {
                            console.info(_t("Sprint") + " " + sprint.name + " " + _t("ended at") + ": " + data.actual_end_date);
                        })
                        .fail((error) => console.error(error));
                    for (let task of sprint.taskList.list.values()) {
                        if (task.wkf_state_type !== "done") {
                            task.setSprint(false);
                        }
                    }
                    this.sprintMap.delete(sprint.id);
                    sprint.destroy();
                    this.renderSprintState();
                });
            },
            drag_start: function (evt) {
                let shortcutPlace = this.$("#backlog-view");
                let shortcuts = [...this.sprintWidgetsMap.values()]
                    .filter(a => a._model.id != evt.target.id)
                    .sort((a, b) => a._model.order > b._model.order)
                    .map(a => {
                        return {id: a._model.id, name: a._model.name.trim()}
                    });
                if (evt.target.id) {
                    shortcuts.push({
                        id: false,
                        name: "Backlog",
                    });
                }
                this.renderDragShortcuts(shortcutPlace, shortcuts, evt.target);
            },
            drag_end: function (evt) {
                this.shortcutContainer && this.shortcutContainer.remove();
                if (!evt.data.sortableEvent.target || evt.data.sortableEvent.target.classList.contains("shortcut-item")) {
                    evt.data.sortableEvent.preventDefault();
                }
            },
        }),
        init(parent, options) {
            this._super(parent, options);

            // Getting board_id from hash and fetch all project_ids from that board in order to create filter for fetching projects
            this.board_id = parseInt(hash_service.get("board"));
            this.task_id = hash_service.get("task") && parseInt(hash_service.get("task"));

            this.sprintDataset = data.getDataSet("project.agile.scrum.sprint");
            this.taskDataset = data.getDataSet("project.task");

            this.projectsAndSprintsReady = this.getProjectsAndSprints(this.board_id);
            this.taskListsReady = this.getTaskLists();

            this.filterQuery = "";
            this.taskWidgetItemMap = new Map();
            this.backlogLength = 10;

            this.backlogEpicSwitch = storage_service.get("backlogEpicSwitch") === undefined ? true : storage_service.get("backlogEpicSwitch");
            this.backlogStorySwitch = storage_service.get("backlogStorySwitch") === undefined ? true : storage_service.get("backlogStorySwitch");

            window.data = data;
            window.blv = this;
        },
        removeNavSearch() {
            core.bus.trigger("search:remove");
        },
        getProjectsAndSprints(board_id) {
            let def = $.Deferred();

            $.when(data.getDataSet("project.project")
                    .read_slice(["name", "board_ids", "workflow_id"], {
                        domain: data.cache.get("current_user").then(user => {
                            return [
                                ["board_ids", "in", board_id],
                                ["id", "in", this.getProjectIds(user)],
                                ["workflow_id", "!=", false]
                            ];
                        }),
                    }),
                data.cache.get("current_user"))
                .then((res, user) => {
                    this.projects = res;
                    this.project_ids = this.getProjectIds(user);
                    this.sprint_ids = user.team_ids[user.team_id].sprint_ids;
                    def.resolve();
                });
            return def.promise();
        },
        getTaskLists() {
            let def = $.Deferred();
            this.projectsAndSprintsReady.then(() => {
                let backlogTasksIdsLoaded = data.getDataSet("project.task")
                    .id_search(this.filterQuery, $.when(data.xmlidToResId("project_agile.project_task_type_epic"), data.xmlidToResId("project_agile.project_task_type_story")).then((epic_type_id, story_type_id) => {
                        let domain = [
                            ["project_id", "in", this.project_ids],
                            ["sprint_id", "=", false],
                            ["wkf_state_type", "!=", "done"]
                        ];
                        !this.backlogEpicSwitch && domain.push(["type_id", "!=", epic_type_id]);
                        !this.backlogStorySwitch && domain.push(["type_id", "!=", story_type_id]);
                        return domain;
                    }), false, false, "agile_order");

                let sprint_context = {"filter_tasks_by_project": this.project_ids};
                let sprintsLoaded = this.sprintDataset.read_slice(false, {
                    domain: [["state", "!=", "completed"], ["id", "in", this.sprint_ids]],
                    context: sprint_context,
                });

                $.when(backlogTasksIdsLoaded, sprintsLoaded).done((backlogTasks, sprints) => {
                    // this.tasks = tasks;
                    // this.taskMap = new Map(tasks.map(e => [e.id, e]));
                    this.sprintMap = new Map();
                    this.backlogTaskIds = backlogTasks;
                    this.ordered_sprint_ids = [];
                    // sort sprints first by order, and then by state so that state is primary sort parameter
                    for (let sprint of sprints.sort((a, b) => a.order - b.order).sort((a, b) => {
                        if (a.state < b.state) {
                            return -1;
                        }
                        if (a.state > b.state) {
                            return 1;
                        }
                        return 0;
                    })) {
                        this.ordered_sprint_ids.push(sprint.id);
                        this.sprintMap.set(sprint.id, sprint);
                    }
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
            this.lastest_sprint_order = 0;
            this.sprintWidgetsMap = new Map();
            for (let sprint_id of this.ordered_sprint_ids) {
                let sprint = this.sprintMap.get(sprint_id);
                let sprintWidget = this.addSprint(sprint);

                if (sprint.state === "active") {
                    this.active_sprint = sprintWidget;
                }
            }

            this.backlogTaskList = new BacklogList(this, {
                model: "project.task",
                ModelItem: TaskItem,
                name: "backlog",
                sortable: {group: "backlog"},
                backlogView: this
            });

            let backlogData = {
                count: "0 issues",
                estimates: {
                    todo: 0,
                    inProgress: 0,
                    done: 0
                }
            };
            this.backlogNode = $(qweb.render("project.agile.backlog", backlogData).trim());
            this.backlogNode.insertAfter(this.$("#backlog-view .section"));
            this.backlogTaskList.insertBefore(this.$(".list-preloader"));

            this.$("#backlog-task-list .story_switch").prop('checked', this.backlogStorySwitch);
            this.$("#backlog-task-list .epic_switch").prop('checked', this.backlogEpicSwitch);
            // this.$(".list-preloader").hide();
            this.renderSprintState();
        },
        start() {
            this._is_added_to_DOM.then(() => {
                core.bus.trigger("search:show", input => {
                    this.applyFilter(input.val());
                });
            });
            this.bindEventListeners();
        },
        bindEventListeners() {
            this.$('.tooltipped').tooltip({delay: 50});
            this.$("#add-sprint").click(() => {
                let sprintData = {
                    'order': ++this.lastest_sprint_order,
                };
                data.session.rpc(`/agile/web/data/sprint/create/`, {'sprint': sprintData})
                    .then(sprint => {
                        this.addSprint(sprint, true);
                    })
                    .fail(e => {
                        console.error(e);
                    });
            });
            this.$("#add-task").click(() => {
                let defaults = {
                    project: this.projects.find(p => p.id == hash_service.get("project"))
                };
                var newItemModal = new AgileModals.NewItemModal(this, {
                    currentProjectId: parseInt(hash_service.get("project")) || undefined,
                    focus: "name",
                    defaults,
                    beforeHook: task => {
                        console.log("before");
                        // Get ModelList widget where task is beeing created
                        let destinationTaskList = (this.sprintWidgetsMap.get(task.sprint_id)) ? this.sprintWidgetsMap.get(task.sprint_id).taskList : this.backlogTaskList;

                        // get agile_order from list
                        task.agile_order = destinationTaskList.getNewOrder(null, destinationTaskList.list.size, task.sprint_id);
                    },
                });
                newItemModal.appendTo($("body"));
            });
            this.$("#backlog-task-list .story_switch").change(evt => {
                this.backlogStorySwitch = evt.target.checked;
                storage_service.set("backlogStorySwitch", evt.target.checked);
                this.applyFilter();
            });
            this.$("#backlog-task-list .epic_switch").change(evt => {
                this.backlogEpicSwitch = evt.target.checked;
                storage_service.set("backlogEpicSwitch", evt.target.checked);
                this.applyFilter();
            });
            core.bus.on("project.task:write", this, (id, vals, payload) => {
                this.removeTask(id, true);
                this.addTask(id, payload);
                if (vals.sprint_id && !this.sprintWidgetsMap.has(vals.sprint_id[0])) {
                    task_service.getRecord(id).then(task => {
                        let user = payload.user_id;
                        if (user.id !== data.session.uid) {

                            var toastContent = $('<div class="toast-content"><p><span class="toast-user-name">' + user.name + '</span> moved ' + task.priority_id[1] + ' ' + task.type_id[1] + ' <span class="toast-task-name">' + task.key + ' - ' + task.name + '</span> to his/her team\'s sprint</p></div>');
                            AgileToast.toast(toastContent, data.getImage("res.users", user.id, user.__last_update), {
                                text: "open", callback: () => {
                                    hash_service.set("task", task.id);
                                    hash_service.set("view", "task");
                                    hash_service.set("page", "board");
                                }
                            });
                        }
                    });
                }
                if (this.rightSideWidget && this.rightSideWidget.id === id) {
                    // Since trigger_up wraps event arguments in data object, here I mimic that behaviour.
                    this.trigger("open_right_side", {data: {WidgetClass: TaskWidget, options: {id, isQuickDetailView: true}}});
                }
            });
            core.bus.on("project.task:create", this, (id, vals, payload) => {
                this.addTask(id, payload);
            });
            core.bus.on("project.task:unlink", this, (id, payload) => {
                this.removeTask(id, true, payload);
                if (this.rightSideWidget && this.rightSideWidget.id === id) {
                    this.rightSideWidget.destroy(true);
                    delete this.rightSideWidget;
                }
            });
        },
        applyFilter(q) {
            if (q !== undefined) {
                this.filterQuery = q;
            }
            data.getDataSet("project.task")
                .id_search("", $.when(data.xmlidToResId("project_agile.project_task_type_epic"), data.xmlidToResId("project_agile.project_task_type_story")).then((epic_type_id, story_type_id) => {
                    let domain = [
                        "&",
                        "|",
                        "|",
                        ["key", "ilike", this.filterQuery],
                        ["description", "ilike", this.filterQuery],
                        ["name", "ilike", this.filterQuery],
                        "&",
                        ["project_id", "in", this.project_ids],                 // Task must be in one of the projects
                        "&",                                                    // Both following criteria has to be truthy
                        "|",                                                // 1. Task must be either in:
                        ["sprint_state", "in", ["draft", "active"]],    //      Active or draft sprint
                        ["sprint_id", "=", false],                      //      Or in backlog
                        "|",                                                // 2. One of the following criteria:
                        "&",                                            //
                        ["sprint_id", "in", this.sprint_ids],       //      Task is in sprint and
                        ["type_id", "!=", epic_type_id],            //      not of type epic
                        "&",                                            //  OR
                        ["sprint_id", "=", false],                  //      Task is in backlog and
                        ["wkf_state_type", "!=", "done"],           //      state type is not "done"
                    ];
                    if (!this.backlogEpicSwitch) {
                        domain.push("|", ["sprint_id", "!=", false], ["type_id", "!=", epic_type_id]);
                    }
                    if (!this.backlogStorySwitch) {
                        domain.push("|", ["sprint_id", "!=", false], ["type_id", "!=", story_type_id]);
                    }
                    return domain;
                }), false, false, "agile_order").then(task_ids => {
                this.allFilteredTaskIds = task_ids;
                let all_task_ids = [...this.allTaskIds()];
                let sprint_task_ids = [...this.sprintTaskIds()];
                // Filter task ids that are not part of sprint/backlog, those tasks can only be tasks from backlog that have initially been filtered out.
                let new_task_ids = task_ids.filter(id => !all_task_ids.includes(id));
                // Push task ids to backlogTaskIds, but only the ones that doesn't belong to sprint
                Array.prototype.push.apply(this.backlogTaskIds, new_task_ids);

                // Extract tasks that belong backlog and satisfies filter criteria
                this.filteredBacklogTaskIds = task_ids.filter(id => this.backlogTaskIds.includes(id));

                // Reset backlog length and slice tasks so that only first page gets loaded.
                this.backlogLength = 10;
                this.filteredBacklogTaskIdsSliced = this.filteredBacklogTaskIds.slice(0, this.backlogLength);

                // All new tasks has to be fetched, since we don't know if they belong to sprint or

                task_service.getRecords(this.filteredBacklogTaskIdsSliced).then(tasks => {
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
        swapSprints(sprintWillGoUp, sprintWillGoDown) {
            // swap on view
            // sprintWillGoUp.$el.remove();
            sprintWillGoUp.$el.insertBefore(sprintWillGoDown.$el);

            // swap model values
            let tmpOrder = sprintWillGoUp._model.order;
            sprintWillGoUp._model.order = sprintWillGoDown._model.order;
            sprintWillGoDown._model.order = tmpOrder;

            // swap in backlogView.__parentedChildren array;
            let goUpIndex = this.__parentedChildren.findIndex(e => e.id == sprintWillGoUp.id);
            let goDownIndex = this.__parentedChildren.findIndex(e => e.id == sprintWillGoDown.id);
            this.__parentedChildren[goUpIndex] = sprintWillGoDown;
            this.__parentedChildren[goDownIndex] = sprintWillGoUp;

            this.renderSprintState();
        },
        addSprint(sprint, highlight) {
            data.cache.get("current_user").then(user => {
                if (!user.team_ids[user.team_id].sprint_ids.includes(sprint.id)) {
                    user.team_ids[user.team_id].sprint_ids.push(sprint.id);
                }
            });
            this.sprintMap.set(sprint.id, sprint);

            let sprintDataWidget = new SprintDataWidget(this, {
                id: sprint.id,
                data: sprint,
                dataset: this.sprintDataset,
                backlogView: this,
            });
            sprintDataWidget.appendTo(this.$("ul.sprint-list"));
            sprintDataWidget._is_rendered.then(() => {
                this.renderSprintState();
            });
            this.sprintWidgetsMap.set(sprint.id, sprintDataWidget);

            if (highlight) {
                sprintDataWidget._is_added_to_DOM.then(() => {
                    $("#backlog-view").scrollToElement(sprintDataWidget.$el);
                    sprintDataWidget.$el.highlight();
                });
            }

            // because moving sprints up and down depends on order in __parentedChildren array, and last element is assumed to be backlog,
            // swap last two elements.
            let c = this.__parentedChildren;
            if (this.backlogTaskList && c[c.length - 2] === this.backlogTaskList) {
                let tmp = c[c.length - 1];
                c[c.length - 1] = c[c.length - 2];
                c[c.length - 2] = tmp;
            }

            // Remember lastest sprint order for creation of new sprints.
            this.lastest_sprint_order = (this.lastest_sprint_order > sprint.order) ? this.lastest_sprint_order : sprint.order;

            return sprintDataWidget;
        },
        renderSprintState() {
            let sprintWidgets = this.__parentedChildren.filter(e => e.dataset && e.dataset.model === "project.agile.scrum.sprint");
            if (sprintWidgets.length < 1) {
                return;
            }
            let hasActive, firstNonActive;
            if (sprintWidgets[0]._model.state === "active") {
                hasActive = true;
                firstNonActive = false;
                sprintWidgets[0].$el.addClass("sprint-active");
            } else {
                sprintWidgets[0].$el.removeClass("sprint-active");
                hasActive = false;
                firstNonActive = true;
            }

            for (let sprint of sprintWidgets) {
                sprint.$("#btn_start").hide();
                sprint.$("#btn_end").hide();
                sprint.$("#btn_up").hide();
                sprint.$("#btn_down").hide();

                if (sprint._model.state === "active") {
                    sprint.$("#btn_end").show();
                    sprint.$("#btn_delete").hide();
                    sprint.$("#start-end-date").text(`${sprint.start_date_f()} - ${sprint.end_date_f()}`);
                    firstNonActive = true;
                } else if (firstNonActive) {
                    if (!hasActive) {
                        sprint.$("#btn_start").show();
                        //sprint.$("#btn_start").attr("disabled", false);
                    }
                    sprint.$("#btn_down").show();
                    firstNonActive = false;
                } else {
                    sprint.$("#btn_up").show();
                    sprint.$("#btn_down").show();
                }
            }
            // Last print
            sprintWidgets[sprintWidgets.length - 1].$("#btn_down").hide();
        },
        * sprintTaskIds() {
            // Iterate trough all sprints and yield task ids
            for (let sprint of this.sprintWidgetsMap.values()) {
                for (let id of sprint._model.task_ids) {
                    yield id;
                }
            }
        },
        * allTaskIds() {
            yield* this.sprintTaskIds();
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
            if (taskWidget.sprintId) {
                let sprintWidget = this.sprintWidgetsMap.get(taskWidget.sprintId);
                sprintWidget && sprintWidget.taskList.removeItem(id);
            }
            if (this.backlogTaskIds.includes(id)) {
                this.backlogTaskIds.splice(this.backlogTaskIds.indexOf(id), 1);
                this.backlogTaskList.removeItem(id);
            }
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
        addTask(id, syncerMeta, highlight = true) {
            $.when(task_service.getRecord(id), data.xmlidToResId("project_agile.project_task_type_epic"), data.xmlidToResId("project_agile.project_task_type_story"), data.cache.get("current_user")).then((task, epic_type_id, story_type_id, user) => {
                // Skip adding tasks from other projects
                if (!this.getProjectIds(user).includes(task.project_id[0])) {
                    return;
                }
                let taskWidget;
                if (task.sprint_id) {
                    // Skip adding tasks with type epic to sprint
                    if (task.type_id[0] === epic_type_id) {
                        return;
                    }
                    let sprint_id = task.sprint_id[0];
                    let sprintWidget = this.sprintWidgetsMap.get(sprint_id);
                    if (!sprintWidget) {
                        return;
                    }
                    taskWidget = sprintWidget.taskList.addItem(task);
                    this.taskWidgetItemMap.has(task.id) || this.taskWidgetItemMap.set(task.id, taskWidget);
                } else {
                    if (task.type_id[0] === epic_type_id && !this.backlogEpicSwitch) {
                        return
                    }
                    if (task.type_id[0] === story_type_id && !this.backlogStorySwitch) {
                        return
                    }
                    if (!this.backlogTaskIds.includes(id)) {
                        this.backlogTaskIds.push(task.id);
                        taskWidget = this.backlogTaskList.addItem(task);
                        this.taskWidgetItemMap.has(task.id) || this.taskWidgetItemMap.set(task.id, taskWidget);
                    } else {
                        taskWidget = this.taskWidgetItemMap.get(task.id);
                    }
                }
                highlight && taskWidget._is_added_to_DOM.then(() => {
                    $("#backlog-view").scrollToElement(taskWidget.$el);
                    taskWidget.$el.highlight();
                });
                if (syncerMeta) {
                    if (syncerMeta.user_id.id !== data.session.uid) {
                        AgileToast.toastTask(syncerMeta.user_id, task, syncerMeta.method);
                    }
                }
            })
        },
        getProjectIds(user) {
            if (hash_service.get("project")) {
                if (isNaN(parseInt(hash_service.get("project")))) {
                    throw new Error("Project id in URL must be a number");
                }
                return [parseInt(hash_service.get("project"))]
            }
            return user.team_ids[user.team_id].project_ids;
        },
        renderDragShortcuts(shortcutPlace, shortcuts, sourceList) {
            this.shortcutContainer = $(`<div class="shortcut-container"></div>`);
            for (let shortcut of shortcuts) {
                let shortcutNode = $(`<div class="shortcut-item agile-main-color lighten-5" data-shortcut-id="${shortcut.id}">${shortcut.name}</div>`);
                shortcutNode[0].addEventListener("dragenter", evt => {
                    $(evt.target).addClass("hover")
                }, false);
                shortcutNode[0].addEventListener("dragleave", evt => {
                    $(evt.target).removeClass("hover")
                }, false);
                Sortable.create(shortcutNode[0], {
                    group: "backlog",
                    onAdd: function (evt) {
                        this.dragShortcutCallback(evt.item, sourceList, shortcut);
                    }.bind(this)
                });
                shortcutNode.appendTo(this.shortcutContainer);
            }
            shortcutPlace.append(this.shortcutContainer);
        },
        dragShortcutCallback(item, sourceList, shortcut) {
            let taskId = parseInt(item.dataset.id);
            let itemWidget = this.taskWidgetItemMap.get(taskId);
            let newListWidget = sourceList._getNewListWidget(shortcut.id);
            // sourceList._setNewItemList(itemWidget, newListWidget);
            let newPosition = shortcut.id ? newListWidget.list.size : 0; // insert to the bottom of the sprint or in the beginning of backlog
            itemWidget.set_list(newListWidget, sourceList.getNewOrder(0, newPosition, shortcut.id, false));
        },
    });

    const SprintDataWidget = DataWidget.extend({
        template: "project.agile.scrum.sprint",
        _name: "SprintDataWidget",
        custom_events: {
            add_item: function (evt) {
                let itemData = evt.data.itemData;
                this.count[itemData.wkf_state_type] += itemData.story_points;

                let wkf_state_class = ".wkf_state_" + itemData.wkf_state_type;
                this.$(wkf_state_class).text(this.count[itemData.wkf_state_type]);
                this.$(".task-count").text((this.taskList.list.size || 0) + " " + pluralize("issue", this.taskList.list.size));
            },
            remove_item: function (evt) {
                let task = this.backlogView.taskWidgetItemMap.get(evt.data.id);
                let wkf_state_class = ".wkf_state_" + task.wkf_state_type;
                this.count[task.wkf_state_type] -= task.story_points;
                this.$(wkf_state_class).text(this.count[task.wkf_state_type]);
                this.$(".task-count").text((this.taskList.list.size || 0) + " " + pluralize("issue", this.taskList.list.size));
            },
        },
        init(parent, options) {
            this._super(parent, options);
            this.pluralize = pluralize;

            this.count = {
                todo: 0,
                in_progress: 0,
                done: 0,
            }
        },
        start_date_f() {
            var formatted = formats.format_value(this._model.start_date, {type: 'datetime'});
            //console.log(`Sprint start date [before/after] formatting: [${this._model.start_date} / ${formatted}]`);
            return formatted;
        },

        end_date_f() {
            var formatted = formats.format_value(this._model.end_date, {type: 'datetime'});
            //console.log(`Sprint end date [before/after] formatting: [${this._model.end_date} / ${formatted}]`);
            return formatted;
        },
        renderElement() {
            this._super();
            this.taskList = new SprintList(this, {
                template: "project.agile.backlog.task_list",
                model: "project.task",
                ModelItem: TaskItem,
                id: this._model.id,
                name: this._model.name,
                attributes: {"data-id": this.id},
                sortable: {group: "backlog"},
                sprintData: this._model,
                backlogView: this.backlogView,
            });
            this.taskList.appendTo(this.$(".collapsible-body"));
        },
        addTask(task) {
            this.taskList.addItem(task);
        },
        start() {
            this.$("#btn_delete").click((e) => {
                this.trigger_up("delete_sprint", {sprint: this});
            });
            this.$("#btn_up").click((e) => {
                this.trigger_up("move_sprint_up", {sprint: this});
            });
            this.$("#btn_down").click((e) => {
                this.trigger_up("move_sprint_down", {sprint: this});
            });
            this.$("#btn_start").click((e) => {
                this.trigger_up("start_sprint", {sprint: this});
            });
            this.$("#btn_end").click((e) => {
                this.trigger_up("end_sprint", {sprint: this});
            });
            return this._super();
        },
        addedToDOM() {
            this._super();
            this.$('.task-list-title, .context-menu').click((evt) => {
                evt.stopPropagation();
            });
            $('.collapsible').collapsible();
        },
    });

    const TaskItem = ModelList.SimpleTaskItem.extend({
        //order_field: "agile_order",
        _name: "TaskItem",
        events: {
            'click': function (evt) {
                if (evt.isDefaultPrevented()) {
                    // Skip if default behaviour is prevented, eg. when clicked on menu.
                    return;
                }
                this._onItemClicked(evt);
            },
        },
        init(parent, options) {
            this._super(parent, options);
            // This field will be used by the view so that it can find task even after record gets updated by the DataService
            this.sprintId = this.record.sprint_id ? this.record.sprint_id[0] : false;
            this.backlogView = parent.backlogView;
        },
        _onItemClicked(evt) {
            this.trigger_up("open_right_side", {WidgetClass: TaskWidget, options: {id: this.record.id, isQuickDetailView: true}});
        },
        start() {
            if (this.record.user_id[0] === data.session.uid) {
                this.$(".assign-to-me").hide();
            }
            this.$(".task-menu, .dropdown-content a").click(evt => {
                // Prevent triggering click handler for entire task item
                evt.preventDefault();
            });
            this.$(".edit-item").click(() => {
                let newItemModal = new AgileModals.NewItemModal(this, {
                    currentProjectId: this.record.project_id[0],
                    focus: "name",
                    edit: this.record,
                });
                newItemModal.appendTo($("body"));
            });

            this.$(".work-log").click(() => {
                let modal = new AgileModals.WorkLogModal(this, {
                    task: this.record,
                    userId: data.session.uid,
                    afterHook: workLog => {
                        // Here we should update right side widget
                        if (this.backlogView.rightSideWidget && this.backlogView.rightSideWidget.id == this.record.id) {
                            this.backlogView.rightSideWidget.addWorkLog(workLog);
                        }
                    }
                });
                modal.appendTo($("body"));

            });

            this.$(".add-link").click(() => {
                var modal = new AgileModals.LinkItemModal(this, {
                    task: this.record,
                    task_ids: [...this.backlogView.allTaskIds()],
                    afterHook: (result) => {
                        // Here we should update right side widget
                        // TODO: implement case when rightsidewidget is related task
                        if (this.backlogView.rightSideWidget && this.backlogView.rightSideWidget.id == this.record.id) {
                            this.backlogView.rightSideWidget.addLink(result);
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
                        if (this.backlogView.rightSideWidget && this.backlogView.rightSideWidget.id == this.record.id) {
                            this.backlogView.rightSideWidget.addComment(comment);
                        }
                    }
                });
                modal.appendTo($("body"));

            });

            !this.task_type.allow_sub_tasks ? this.$(".add-sub-item").hide() :
                this.$(".add-sub-item").click(() => {
                    // let backlogView = this.backlogView;
                    var newItemModal = new AgileModals.NewItemModal(this, {
                        currentProjectId: this.record.project_id[0],
                        projects: this.backlogView.projects,
                        parent_id: this.record.id,
                        afterHook: subtask => {
                            // Here we should update right side widget
                            if (this.backlogView.rightSideWidget && this.backlogView.rightSideWidget.id == this.record.id) {
                                this.backlogView.rightSideWidget.addSubTask(subtask);
                            }
                        }
                    });
                    newItemModal.appendTo($("body"));
                });

            this.$(".assign-to-me").click(() => {
                data.getDataSet("project.task").call('write', [[this.record.id], {'user_id': data.session.uid}]).then(() => {
                    data.cache.get("current_user").then(user => {
                        this.user_id = [user.id, user.name];
                        if (this.backlogView.rightSideWidget && this.backlogView.rightSideWidget.id === this.id) {
                            this.backlogView.rightSideWidget.setAssignee({id: user.id, name: user.name}, false);
                        }
                        this.rerenderWidget();
                    });
                });
            });
            this.$(".delete").click(() => {
                data.getDataSet("project.task").unlink([this.record.id]);
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
        setSprint(sprint_id) {
            if (sprint_id) {
                let sprintWidget = this.backlogView.sprintWidgetsMap.get(sprint_id);
                if (sprintWidget) {
                    sprintWidget.addItem(this);
                }
                return;
            }
            this.sprint_id = sprint_id;
            this.backlogView.backlogTaskList.addItem(this);
        },
        set_list(listWidget, order) {
            this.dataset.write(this.record.id, {sprint_id: listWidget.id, [this.order_field]: order})
                .done(r => console.info(`Agile sprint and order saved for task: ${listWidget.id}, ${order}`))
                .fail(r => console.error("Error while saving agile order: ", r));
        }
    });
    TaskItem.sort_by = "agile_order";
    TaskItem.default_fields = ["name", "project_id", "sprint_id", "agile_order", 'wkf_state_type'];

    const SprintList = ModelList.ModelList.extend({
        _name: "SprintList",
        _getNewListWidget(sprint_id) {
            // first parent is sprint, and grandparent is backlog view;
            let sprintList = this.backlogView.sprintWidgetsMap;
            if (sprintList.has(sprint_id)) {
                return sprintList.get(sprint_id).taskList;
            } else {
                return this.backlogView.backlogTaskList;
            }
        },
        loadItems() {
            this.task_ids = this.sprintData.task_ids;
            this.allFilteredTaskIds = this.backlogView.allFilteredTaskIds !== undefined ?
                this.backlogView.allFilteredTaskIds.filter(id => this.task_ids.includes(id)) :
                this.task_ids;
            return task_service.getRecords(this.allFilteredTaskIds).then(tasks => this.data = tasks);
        },
        addItem(item) {
            if (this.list.has(item.id)) {
                return this.list.get(item.id);
            }
            let cachedWidget = this.backlogView.taskWidgetItemMap.get(item.id);

            !this.task_ids.includes(item.id) && this.task_ids.push(item.id);

            // Use cached widget if exists on backlog view, or create it and store in cache
            let retVal = this._super(cachedWidget || item);
            cachedWidget || this.backlogView.taskWidgetItemMap.set(item.id, retVal);
            return retVal;
        },
        removeItem(id) {
            let retVal = this._super.apply(this, arguments);
            this.task_ids.includes(id) && this.task_ids.splice(this.task_ids.indexOf(id), 1);
            return retVal;
        },
        destroy() {
            this.__parentedChildren.forEach(c => c.setParent(undefined));
            mixins.PropertiesMixin.destroy.call(this);
        },
    });

    const BacklogList = ModelList.ModelList.extend({
        _name: "BacklogList",
        init(parent, options) {
            this._super(parent, options);
            this.shouldLoadMore = true;
        },
        _getNewListWidget(sprint_id) {
            let sprintList = this.backlogView.sprintWidgetsMap;
            if (sprintList.has(sprint_id)) {
                return sprintList.get(sprint_id).taskList;
            } else {
                //order = false;
                return this.backlogView.backlogTaskList;
            }
        },
        loadItems() {
            if (this.backlogView) {
                this.task_ids = this.backlogView.allFilteredTaskIds !== undefined ? this.backlogView.filteredBacklogTaskIdsSliced : this.backlogView.backlogTaskIds.slice(0, this.backlogView.backlogLength);
                return task_service.getRecords(this.task_ids).then(tasks => this.data = tasks);
            } else {
                return $.when()
            }
        },
        loadMoreItems() {
            if (this.backlogView) {
                this.backlogView.backlogLength += 10;
                this.task_ids = this.backlogView.allFilteredTaskIds !== undefined ?
                    this.backlogView.filteredBacklogTaskIdsSliced = this.backlogView.filteredBacklogTaskIds.slice(0, this.backlogView.backlogLength) :
                    this.backlogView.backlogTaskIds.slice(0, this.backlogView.backlogLength);
                this.backlogView.$(".list-preloader").show();
                task_service.getRecords(this.task_ids).then(tasks => this.data = tasks).then(tasks => {
                    for (let task of tasks) {
                        if (!this.list.has(task.id)) {
                            this.addItem(task);
                        }
                    }
                    this.backlogView.$(".list-preloader").hide();
                    this.shouldLoadMore = (this.backlogView.filteredBacklogTaskIds === undefined ?
                        this.backlogView.backlogTaskIds.length :
                        this.backlogView.filteredBacklogTaskIds.length) > this.list.size;

                    /* Because lazy loading backlog items work when you scroll down to bottom of backlog,
                    * we need to manage the case where bottom of backlog is above bottom of window.
                    * In such case, when master list is less then 110% in height, load more items if available
                    */
                    if (this.backlogView.filteredBacklogTaskIds != undefined) {
                        this.backlogView.backlogNode.find(".task-count").text((this.list.size || 0) + " of " + this.backlogView.filteredBacklogTaskIds.length + " " + pluralize("issue", this.backlogView.filteredBacklogTaskIds.length));
                    }
                    if (this.shouldLoadMore && this.backlogView && this.backlogView.$(".master-list").height() / this.backlogView.$el.height() < 1.1) {
                        this.loadMoreItems();
                    }
                    Waypoint.refreshAll();
                })
            }
        },
        addItem(item) {
            if (this.backlogView) {
                !this.task_ids.includes(item.id) && this.task_ids.push(item.id);

                let cachedWidget = this.backlogView.taskWidgetItemMap.get(item.id);
                // Use cached widget if exists on backlog view, or create it and store in cache
                let retVal = this._super(cachedWidget || item);
                cachedWidget || this.backlogView.taskWidgetItemMap.set(item.id, retVal);

                this.backlogView.filteredBacklogTaskIds && !this.backlogView.filteredBacklogTaskIds.includes(item.id) && this.backlogView.filteredBacklogTaskIds.push(item.id);
                !this.backlogView.backlogTaskIds.includes(item.id) && this.backlogView.backlogTaskIds.push(item.id);
                let backlogNode = this.backlogView.backlogNode;

                let totalTaskCount = this.backlogView.filteredBacklogTaskIds ? this.backlogView.filteredBacklogTaskIds.length :
                    this.backlogView.backlogTaskIds ? this.backlogView.backlogTaskIds.length : 0;
                backlogNode.find(".task-count").text((this.list.size || 0) + " of " + totalTaskCount + " " + pluralize("issue", totalTaskCount));
                return retVal;
            }
        },
        removeItem(id) {
            let retVal = this._super(id);
            if (this.backlogView) {
                this.task_ids.includes(id) && this.task_ids.splice(this.task_ids.indexOf(id), 1);

                if (this.backlogView.filteredBacklogTaskIds && this.backlogView.filteredBacklogTaskIds.includes(id)) {
                    this.backlogView.filteredBacklogTaskIds.splice(this.backlogView.filteredBacklogTaskIds.indexOf(id), 1);
                }
                if (this.backlogView.backlogTaskIds.includes(id)) {
                    this.backlogView.backlogTaskIds.splice(this.backlogView.backlogTaskIds.indexOf(id), 1);
                }
                let backlogNode = this.backlogView.backlogNode;

                let totalTaskCount = this.backlogView.filteredBacklogTaskIds ? this.backlogView.filteredBacklogTaskIds.length :
                    this.backlogView.backlogTaskIds ? this.backlogView.backlogTaskIds.length : 0;
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
                context: "#backlog-view",
                offset: 'bottom-in-view'
            })
        }
    });

    ViewManager.include({
        build_view_registry() {
            this._super();
            this.view_registry.set("scrum", BacklogView);
        },
    });

    return {
        BacklogView,
        BacklogList,
        TaskItem,
        SprintList,
        SprintDataWidget
    };
})
;