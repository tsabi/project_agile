.. image:: https://www.gnu.org/graphics/lgplv3-147x51.png
   :target: https://www.gnu.org/licenses/lgpl-3.0.en.html
   :alt: License: LGPL-v3

==================
Project Agile JIRA
==================

Very lightweight module which enables you to migrate your projects and tasks from JIRA to Odoo.
Not to be considered as one of the Odoo/JIRA synchronization modules out there.

Usage
=====

Go to: Project -> Configuration -> Services -> Jira

#. Hit create button
#. Enter required details as: config name, your jira URL as well as JIRA username/password
#. Hit save button
#. Hit "Synchronize Projects" button which will generate background request for project import.
#. Hit "Synchronize Tasks" button on the form which will generate background request for tasks import.
#. Wait until cron job finishes import.

::

   Please note that in the time we wrote this module it was not possible to import JIRA workflow
   due to the bug in their API, so, as the step 0 (zero) you must first manually replicate workflow in Odoo
   and assign it to the project(s) you want to import.

Credits
=======


Contributors
------------

* Sladjan Kantar <sladjan.kantar@modoolar.com>
* Petar Najman <petar.najman@modoolar.com>

Maintainer
----------

.. image:: https://modoolar.com/modoolar-static/modoolar-logo.png
   :alt: Modoolar
   :target: https://modoolar.com

This module is maintained by Modoolar.

::

   As Odoo Silver partner, our company is specialized in Odoo ERP customization and business solutions development.
   Beside that, we build cool apps on top of Odoo platform.

To contribute to this module, please visit https://modoolar.com
