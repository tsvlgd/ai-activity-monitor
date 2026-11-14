// Desktop notifications through the shell's own message tray (GNOME 46 API).
// One live notification per session: a new one replaces the previous, so a
// session can never stack duplicates in the notification list.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

import {NotifyKind} from './core/policy.js';
import {formatDuration} from './core/model.js';
import {providerInfo} from './providers.js';

export class Notifier {
    constructor(extensionDir, {onFocus}) {
        this._dir = extensionDir;
        this._onFocus = onFocus;
        this._source = null;
        this._bySession = new Map();
        this._kinds = new Map();
    }

    _ensureSource() {
        if (this._source)
            return this._source;
        this._source = new MessageTray.Source({
            title: 'AI Activity',
            icon: new Gio.ThemedIcon({name: 'utilities-terminal-symbolic'}),
        });
        this._source.connect('destroy', () => {
            this._source = null;
            this._bySession.clear();
            this._kinds.clear();
        });
        Main.messageTray.add(this._source);
        return this._source;
    }

    _icon(provider) {
        const info = providerInfo(provider);
        if (!info.icon)
            return new Gio.ThemedIcon({name: 'utilities-terminal-symbolic'});
        return Gio.FileIcon.new(this._dir.get_child('icons').get_child(info.icon));
    }

    notify(session, decision) {
        const name = providerInfo(session.provider).name;
        const dir = session.projectDir || session.cwd;
        const project = dir ? GLib.path_get_basename(dir) : '';
        const where = project ? ` in ${project}` : '';
        let title, body;
        switch (decision.kind) {
        case NotifyKind.APPROVAL:
            title = `${name} needs your approval`;
            body = `${session.detail}${where ? `\n${project}` : ''}`;
            break;
        case NotifyKind.INPUT:
            title = `${name} is waiting for input`;
            body = `${session.detail}${where ? `\n${project}` : ''}`;
            break;
        case NotifyKind.COMPLETED:
            title = `${name} finished${where}`;
            body = session.lastTurnSeconds ? `Task completed in ${formatDuration(session.lastTurnSeconds)}` : 'Task completed';
            break;
        case NotifyKind.ERROR:
            title = `${name} stopped with an error`;
            body = `${session.lastError || 'Agent error'}${where ? `\n${project}` : ''}`;
            break;
        case NotifyKind.TERMINATED:
            title = `${name} session ended unexpectedly`;
            body = project ? `${project}: the agent process exited without closing its session` : 'The agent process exited without closing its session';
            break;
        default:
            return;
        }

        // Replace first, then acquire the source: removing a source's last
        // notification destroys the source itself (GNOME 46), so taking the
        // source before the replace would add the new one to a dead source.
        this._bySession.get(session.key)?.destroy();
        const source = this._ensureSource();
        const n = new MessageTray.Notification({
            source,
            title,
            body,
            gicon: this._icon(session.provider),
            urgency: decision.urgent ? MessageTray.Urgency.HIGH : MessageTray.Urgency.NORMAL,
        });
        if (decision.kind !== NotifyKind.TERMINATED)
            n.addAction('Focus terminal', () => this._onFocus(session.key));
        n.connect('destroy', () => {
            if (this._bySession.get(session.key) === n) {
                this._bySession.delete(session.key);
                this._kinds.delete(session.key);
            }
        });
        this._bySession.set(session.key, n);
        this._kinds.set(session.key, decision.kind);
        source.addNotification(n);
    }

    // Approval notifications are stale once the agent moves on.
    withdraw(sessionKey, kinds = null) {
        const n = this._bySession.get(sessionKey);
        if (!n)
            return;
        if (kinds && !kinds.includes(this._kinds.get(sessionKey)))
            return;
        n.destroy();
    }

    destroy() {
        this._source?.destroy();
        this._source = null;
        this._bySession.clear();
    }
}
