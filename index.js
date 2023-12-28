import { chat_metadata, eventSource, event_types, sendSystemMessage } from '../../../../script.js';
import { getContext, saveMetadataDebounced } from '../../../extensions.js';
import { executeSlashCommands, registerSlashCommand } from '../../../slash-commands.js';
import { delay } from '../../../utils.js';
import { quickReplyApi } from '../../quick-reply/index.js';

const log = (...msg) => console.log('[TC]', ...msg);




/**@type {Object} */
let settings;
/**@type {Promise} */
let loop;
/**@type {Boolean} */
let isRunning = false;
/**@type {String} */
let groupId;
/**@type {HTMLElement} */
let root;
/**@type {HTMLImageElement[]} */
let imgs = [];
/**@type {Object[]} */
let nameList = [];




const loadSettings = ()=>{
    settings = Object.assign({
        isEnabled: true,
        actionQrSet: null,
        memberQrSet: null,
        memberList: null,
    }, chat_metadata.triggerCards ?? {});
    chat_metadata.triggerCards = settings;
};
const init = ()=>{
    registerSlashCommand('tc-on', (args, value)=>activate(args, value), [], '<span class="monospace">[actions=qrSetName members=qrSetName reset=true] ([member1, member2, ...])</span> – Activate trigger cards', true, true);
    registerSlashCommand('tc-off', (args, value)=>deactivate(), [], 'Deactivate trigger cards', true, true);
    registerSlashCommand('tc?', (args, value)=>showHelp(), [], 'Show help for trigger cards', true, true);
};
eventSource.on(event_types.APP_READY, ()=>init());
const activate = (args, members) => {
    if (!groupId) return;
    const memberList = members?.split(/\s*,\s*/)?.filter(it=>it);
    settings.actionQrSet = args.actions ?? (args.reset ? null : settings.actionQrSet);
    settings.memberQrSet = args.members ?? (args.reset ? null : settings.memberQrSet);
    settings.memberList = memberList && memberList.length > 0 ? memberList : (args.reset ? null : settings.memberList);
    if (settings.memberList && settings.memberList.filter(it=>it).length <= 1) settings.memberList = null;
    settings.isEnabled = true;
    saveMetadataDebounced();
    restart();
};
const deactivate = async () => {
    if (!groupId) return;
    settings.isEnabled = false;
    saveMetadataDebounced();
    await end();
};
const showHelp = () => {
    sendSystemMessage('generic', `
        <h3>Trigger Cards</h3>
        <div>
            All settings are saved to the active chat.
        </div>
        <div>
            <code>/tc-on</code> to enable trigger cards.
        </div>
        <div>
            By default, a trigger card is created for each group member with the following actions:
        </div>
        <ul>
            <li><code>click</code> – trigger the character to speak</li>
            <li><code>shift + click</code> – unmute the character</li>
            <li><code>alt + click</code> – mute the character</li>
        </ul>
        <div>
            To restore these default settings use <code>/tc-on reset=true</code>
        </div>

        <hr>

        <h3>Custom cards</h3>
        <div>
            Instead of the member list, you can use a custom list of cards by either providing the name of a
            Quick Reply set (the labels of the quick replies will be used as character names and to find the
            corresponding expression images, add <code>::qr</code> to the label to execute the quick reply on
            click instead of the normal click action) or by providing a comma-separated list of names.
        </div>
        <div>
            <code>/tc-on members=myQrSet</code>
        </div>
        <div>
            <code>/tc-on Name1, Name2, Name3</code>
        </div>

        <hr>

        <h3>Custom actions</h3>
        <div>
            To use another set of actions on the cards, you can provide the name of a Quick Reply set.
        </div>
        <div>
            <code>/tc-on actions=myQrSet</code>
        </div>
        <div>
            In the quick replies you can use <code>{{arg::name}}</code> to get the character's name.
        </div>
        <div>
            <code>/trigger {{arg::name}}</code>
        </div>
        <div>
            The quick replies should be labeled as follows (use the title field in the additional options
            dialog for the tooltip on the trigger card):
        </div>
        <ul>
            <li>
                <code></code> (empty label) – click (if you are using a QR set as member list, not providing
                    this QR will result in a click calling the QR's command)
            </li>
            <li><code>c</code> – ctrl + click</li>
            <li><code>s</code> – shift + click</li>
            <li><code>a</code> – alt + click</li>
            <li><code>cs</code> – ctrl + shift + click</li>
            <li><code>ca</code> – ctrl + alt + click</li>
            <li><code>sa</code> – shit + alt + click</li>
            <li><code>csa</code> – ctrl + shift + alt + click</li>
        </ul>
    `);
};




const chatChanged = async()=>{
    const context = getContext();
    groupId = context.groupId;
    if (context.groupId) {
        loadSettings();
        if (settings?.isEnabled) {
            await restart();
        } else {
            await end();
        }
    } else {
        settings = null;
        await end();
    }
};
eventSource.on(event_types.CHAT_CHANGED, ()=>chatChanged());




const handleClick = async (/**@type {MouseEvent}*/evt, /**@type {String}*/fullName) => {
    evt.preventDefault();
    evt.stopPropagation();
    const [name, ...args] = fullName.split('::');
    if (settings.memberQrSet && args.includes('qr')) {
        try {
            await quickReplyApi.executeQuickReply(settings.memberQrSet, fullName);
        } catch (ex) {
            toastr.error(ex.message);
        }
    } else {
        const modifiers = [];
        if (evt.ctrlKey) modifiers.push('c');
        if (evt.shiftKey) modifiers.push('s');
        if (evt.altKey) modifiers.push('a');
        const mod = modifiers.join('');
        if (settings.actionQrSet) {
            if (quickReplyApi.listQuickReplies(settings.actionQrSet).includes(mod)) {
                try {
                    await quickReplyApi.executeQuickReply(settings.actionQrSet, mod, { name, set:settings.memberQrSet });
                } catch (ex) {
                    toastr.error(ex.message);
                }
            } else if (settings.memberQrSet) {
                try {
                    await quickReplyApi.executeQuickReply(settings.memberQrSet, name);
                } catch (ex) {
                    toastr.error(ex.message);
                }
            }
        } else {
            let cmd;
            switch (mod) {
                case '': {
                    cmd = `/trigger ${name}`;
                    break;
                }
                case 's': {
                    cmd = `/enable ${name}`;
                    break;
                }
                case 'a': {
                    cmd = `/disable ${name}`;
                    break;
                }
            }
            if (cmd) {
                try {
                    executeSlashCommands(cmd);
                } catch (ex) {
                    toastr.error(ex.message);
                }
            }
        }
    }
};
const handleTitle = async (el, fullName) => {
    const [name, ...args] = fullName.split('::');
    let titleParts = [name];
    if (settings.memberQrSet && args.includes('qr')) {
        const qr = quickReplyApi.getQrByLabel(settings.memberQrSet, fullName);
        titleParts.push(qr.title || qr.message);
    } else if (settings.actionQrSet) {
        const mods = {
            'c': 'ctrl',
            's': 'shift',
            'a': 'alt',
        };
        const set = quickReplyApi.getSetByName(settings.actionQrSet);
        titleParts.push(...set.qrList.map(qr=>`${[...qr.label.split('').map(m=>mods[m]), 'click'].join(' + ')}: ${qr.title ?? ''}`));
    } else {
        titleParts.push(
            'click: trigger',
            'shift + click: unmute',
            'alt + click: mute',
        );
    }
    titleParts.splice(1, 0, '-'.repeat(titleParts.reduce((max,cur)=>Math.max(max,cur.length),0)*1.2));
    el.title = titleParts.join('\n');
};
const getNames = ()=>{
    if (settings.memberList && settings.memberList.length > 0) {
        return settings.memberList;
    }
    if (settings.memberQrSet) {
        try {
            return quickReplyApi.listQuickReplies(settings.memberQrSet);
        } catch {
            return [];
        }
    }
    const context = getContext();
    const group = context.groups.find(it=>it.id == groupId);
    const members = group.members.map(m=>context.characters.find(c=>c.avatar == m));
    const names = members.map(it=>it.name);
    return names;
};
const updateMembers = async() => {
    while (settings?.isEnabled && isRunning) {
        const names = getNames();
        // [1,2,3,4,5,6,7,8].forEach(it=>names.push(...members.map(x=>x.name)));
        const removed = nameList.filter(it=>names.indexOf(it) == -1);
        const added = names.filter(it=>nameList.indexOf(it) == -1);
        for (const name of removed) {
            nameList.splice(nameList.indexOf(name), 1);
            let idx = imgs.findIndex(it=>it.getAttribute('data-character') == name);
            const img = imgs.splice(idx, 1)[0];
            img.remove();
        }
        for (const name of added) {
            nameList.push(name);
            const wrap = document.createElement('div'); {
                wrap.classList.add('sttc--wrapper');
                wrap.addEventListener('click', (evt)=>handleClick(evt, name));
                wrap.addEventListener('pointerenter', ()=>handleTitle(wrap, name));
                const img = document.createElement('img'); {
                    img.classList.add('sttc--img');
                    img.setAttribute('data-character', name);
                    img.src = `/characters/${name.split('::')[0]}/joy.png`;
                    wrap.append(img);
                }
                const before = imgs.find(it=>name.localeCompare(it.getAttribute('data-character')) == -1);
                if (before) {
                    log('putting', name, 'before', before);
                    before.closest('.sttc--wrapper').insertAdjacentElement('beforebegin', wrap);
                    imgs.splice(imgs.indexOf(before), 0, img);
                } else {
                    log('putting', name, 'at end');
                    root.append(wrap);
                    imgs.push(img);
                }
            }
        }
        await delay(500);
    }
};




const restart = async()=>{
    await end();
    start();
};
const start = () => {
    document.querySelector('#form_sheld').style.position = 'relative';
    root = document.createElement('div'); {
        root.classList.add('sttc--root');
        root.addEventListener('wheel', evt=>{
            evt.preventDefault();
            root.scrollLeft += evt.deltaY;
        });
        document.querySelector('#form_sheld').append(root);
    }
    isRunning = true;
    loop = updateMembers();
};
const end = async () => {
    isRunning = false;
    if (loop) await loop;
    nameList = [];
    root?.remove();
    root = null;
    document.querySelector('#form_sheld').style.position = '';
    while (imgs.length > 0) {
        imgs.pop();
    }
};
