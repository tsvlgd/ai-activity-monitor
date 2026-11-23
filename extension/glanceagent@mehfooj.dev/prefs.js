import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const EDGES = ['left', 'right'];

export default class AiActivityMonitorPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window._settings = settings;

        const spin = (group, key, title, subtitle, lower, upper, step) => {
            const row = new Adw.SpinRow({
                title,
                subtitle,
                adjustment: new Gtk.Adjustment({
                    lower, upper, step_increment: step, page_increment: step * 10,
                }),
            });
            settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
            group.add(row);
        };

        const sw = (group, key, title, subtitle) => {
            const row = new Adw.SwitchRow({title, subtitle});
            settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            group.add(row);
        };

        // Placement
        const placement = new Adw.PreferencesPage({
            title: 'Placement',
            icon_name: 'preferences-desktop-display-symbolic',
        });
        const placeGroup = new Adw.PreferencesGroup({title: 'Placement'});
        placement.add(placeGroup);

        const edgeRow = new Adw.ComboRow({
            title: 'Screen edge',
            subtitle: 'Edge the tiles dock to',
            model: Gtk.StringList.new(['Left', 'Right']),
        });
        const syncEdge = () => {
            const idx = EDGES.indexOf(settings.get_string('edge'));
            edgeRow.selected = idx >= 0 ? idx : 0;
        };
        syncEdge();
        edgeRow.connect('notify::selected', () => {
            const value = EDGES[edgeRow.selected] ?? 'left';
            if (settings.get_string('edge') !== value)
                settings.set_string('edge', value);
        });
        const edgeChangedId = settings.connect('changed::edge', syncEdge);
        window.connect('close-request', () => {
            settings.disconnect(edgeChangedId);
            return false;
        });
        placeGroup.add(edgeRow);

        const showRow = new Adw.ComboRow({
            title: 'Show tiles',
            subtitle: 'On the desktop (hidden under windows), or above every application',
            model: Gtk.StringList.new(['On the desktop', 'Always on top']),
        });
        const SHOW = ['desktop', 'always'];
        const syncShow = () => {
            showRow.selected = Math.max(0, SHOW.indexOf(settings.get_string('show-on')));
        };
        syncShow();
        showRow.connect('notify::selected', () => {
            const value = SHOW[showRow.selected] ?? 'desktop';
            if (settings.get_string('show-on') !== value)
                settings.set_string('show-on', value);
        });
        const showChangedId = settings.connect('changed::show-on', syncShow);
        window.connect('close-request', () => {
            settings.disconnect(showChangedId);
            return false;
        });
        placeGroup.add(showRow);
        sw(placeGroup, 'panel-indicators', 'Top bar icons', 'Icons after the workspace indicator, visible from every window');
        sw(placeGroup, 'desktop-tiles', 'Desktop tiles', 'Draggable tiles on the desktop, hidden under windows');
        sw(placeGroup, 'desktop-play', 'Play on the empty desktop', 'Tiles drift around, bounce and say hi when no window is open');

        // Dragging a tile stores a free position; this returns to edge docking.
        const resetRow = new Adw.ActionRow({
            title: 'Dragged position',
            subtitle: 'Drag any tile to place it anywhere; Reset returns them to the edge',
        });
        const resetButton = new Gtk.Button({label: 'Reset', valign: Gtk.Align.CENTER});
        resetButton.connect('clicked', () => {
            settings.set_string('tile-positions', '{}');
            settings.set_string('panel-placement', '{}');
        });
        resetRow.add_suffix(resetButton);
        placeGroup.add(resetRow);

        // A dragged tile stays parked and does not roam; this frees every tile.
        const releaseRow = new Adw.ActionRow({
            title: 'Parked tiles',
            subtitle: 'A dragged tile stays where you drop it. Double click it, or Release all, to let it roam again',
        });
        const releaseButton = new Gtk.Button({label: 'Release all', valign: Gtk.Align.CENTER});
        releaseButton.connect('clicked', () => settings.set_string('tile-positions', '{}'));
        releaseRow.add_suffix(releaseButton);
        placeGroup.add(releaseRow);

        spin(placeGroup, 'offset-x', 'Horizontal offset', 'Distance from the screen edge in pixels', 0, 400, 1);
        spin(placeGroup, 'offset-y', 'Vertical offset', 'Distance from the top of the work area in pixels', 0, 2000, 1);
        spin(placeGroup, 'icon-size', 'Tile size', 'Size of each tile in pixels', 24, 64, 1);
        spin(placeGroup, 'spacing', 'Spacing', 'Gap between tiles in pixels', 0, 40, 1);
        window.add(placement);

        // Behaviour
        const behaviour = new Adw.PreferencesPage({
            title: 'Behaviour',
            icon_name: 'preferences-system-symbolic',
        });
        const behGroup = new Adw.PreferencesGroup({title: 'Behaviour'});
        behaviour.add(behGroup);
        sw(behGroup, 'animate-working', 'Animate working state', 'Gentle movement while an agent works');
        sw(behGroup, 'hide-idle', 'Hide idle sessions', 'Show a tile only while an agent is busy, waiting, or just finished');
        spin(behGroup, 'completed-hold-seconds', 'Completed hold time', 'Seconds before completed or error reverts to idle', 30, 86400, 30);
        window.add(behaviour);

        // Notifications
        const notif = new Adw.PreferencesPage({
            title: 'Notifications',
            icon_name: 'preferences-system-notifications-symbolic',
        });
        const notifGroup = new Adw.PreferencesGroup({title: 'Notifications'});
        notif.add(notifGroup);
        sw(notifGroup, 'notify-completed', 'Turn completed', null);
        sw(notifGroup, 'notify-approval', 'Approval needed', null);
        sw(notifGroup, 'notify-error', 'Error', null);
        sw(notifGroup, 'notify-terminated', 'Session terminated', null);
        spin(notifGroup, 'min-turn-seconds', 'Minimum turn length', 'Completion notification only for turns at least this many seconds long', 0, 3600, 1);
        window.add(notif);

        // Privacy and terminal
        const privacy = new Adw.PreferencesPage({
            title: 'Privacy and terminal',
            icon_name: 'preferences-system-privacy-symbolic',
        });
        const privGroup = new Adw.PreferencesGroup({title: 'Privacy and terminal'});
        privacy.add(privGroup);
        sw(privGroup, 'show-prompt-text', 'Show prompt text', 'Show prompt previews in the activity preview');

        const termRow = new Adw.EntryRow({
            title: 'Terminal command (%d is the session directory)',
            show_apply_button: true,
        });
        settings.bind('terminal-command', termRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        privGroup.add(termRow);
        window.add(privacy);
    }
}
