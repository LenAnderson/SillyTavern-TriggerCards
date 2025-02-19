import { characters, chat_metadata, eventSource, event_types, getRequestHeaders, reloadMarkdownProcessor, sendSystemMessage } from '../../../../script.js';
import { getContext, saveMetadataDebounced } from '../../../extensions.js';
import { executeSlashCommands, executeSlashCommandsWithOptions, registerSlashCommand } from '../../../slash-commands.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../../slash-commands/SlashCommandArgument.js';
import { SlashCommandEnumValue } from '../../../slash-commands/SlashCommandEnumValue.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { debounce, delay } from '../../../utils.js';
import { quickReplyApi } from '../../quick-reply/index.js';
import { Settings } from './src/Settings.js';

const log = (...msg) => console.log('[TC]', ...msg);




/**@type {Settings} */
let settings;
/**@type {Promise} */
let loop;
/**@type {Boolean} */
let isRunning = false;
/**@type {string} */
export let groupId;
/**@type {HTMLElement} */
let root;
/**@type {HTMLImageElement[]} */
let imgs = [];
/**@type {Object[]} */
let nameList = [];




const loadSettings = ()=>{
    settings = new Settings();
    settings.onRestart = ()=>restartDebounced();
    chat_metadata.triggerCards = settings;
};
const init = ()=>{
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'tc-config',
        callback: async(args, value)=>{
            await settings.show();
            return '';
        },
        helpString: 'Open Trigger Cards setting menu.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'tc-on',
        callback: (args, value)=>activate(args, value),
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({ name: 'actions',
                description: 'name of a QR set for click actions, see /tc?',
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: ()=>quickReplyApi.listSets().map(it=>new SlashCommandEnumValue(it)),
            }),
            SlashCommandNamedArgument.fromProps({ name: 'members',
                description: 'name of a QR set used as member list, see /tc?',
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: ()=>quickReplyApi.listSets().map(it=>new SlashCommandEnumValue(it)),
            }),
            SlashCommandNamedArgument.fromProps({ name: 'emote',
                description: 'character expression to use for trigger card',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: [
                    'admiration',
                    'amusement',
                    'anger',
                    'annoyance',
                    'approval',
                    'caring',
                    'confusion',
                    'curiosity',
                    'desire',
                    'disappointment',
                    'disapproval',
                    'disgust',
                    'embarrassment',
                    'excitement',
                    'fear',
                    'gratitude',
                    'grief',
                    'joy',
                    'love',
                    'nervousness',
                    'optimism',
                    'pride',
                    'realization',
                    'relief',
                    'remorse',
                    'sadness',
                    'surprise',
                    'neutral',
                ],
            }),
            SlashCommandNamedArgument.fromProps({ name: 'extensions',
                description: 'file extensions to use for expression image',
                typeList: [ARGUMENT_TYPE.STRING],
            }),
            SlashCommandNamedArgument.fromProps({ name: 'grayscale',
                description: 'show absent members desaturated',
                typeList: ARGUMENT_TYPE.BOOLEAN,
            }),
            SlashCommandNamedArgument.fromProps({ name: 'mute',
                description: 'show unmuted characters opaque',
                typeList: ARGUMENT_TYPE.BOOLEAN,
            }),
            SlashCommandNamedArgument.fromProps({ name: 'reset',
                description: 'reset all settings',
                typeList: ARGUMENT_TYPE.BOOLEAN,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({ description: 'comma separated list of names to use as member list',
                typeList: ARGUMENT_TYPE.STRING,
            }),
        ],
        helpString: 'Activate Trigger Cards',
    }));
    registerSlashCommand('tc-off', (args, value)=>deactivate(), [], 'Deactivate trigger cards', true, true);
    registerSlashCommand('tc?', (args, value)=>showHelp(), [], 'Show help for trigger cards', true, true);
};
init();
// eventSource.on(event_types.APP_READY, ()=>init());
const activate = async(args, members) => {
    const memberList = members?.split(/\s*,\s*/)?.filter(it=>it);
    const extList = args.extensions?.split(',')?.filter(it=>it);
    let gray;
    try {
        gray = JSON.parse(args.gray ?? args.grey ?? 'null');
    } catch { /* empty */ }
    let mute;
    try {
        mute = JSON.parse(args.mute ?? args.grey ?? 'null');
    } catch { /* empty */ }
    settings.actionQrSet = args.actions ?? (args.reset ? undefined : settings.actionQrSet);
    settings.memberQrSet = args.members ?? (args.reset ? undefined : settings.memberQrSet);
    settings.memberList = memberList && memberList.length > 0 ? memberList : (args.reset ? undefined : settings.memberList);
    if (settings.memberList && settings.memberList.filter(it=>it).length <= 0) settings.memberList = undefined;
    settings.expression = args.emote ?? (args.reset ? 'joy' : settings.expression) ?? 'joy';
    settings.extensions = extList && extList.length > 0 ? extList : (args.reset ? ['png', 'webp', 'gif'] : settings.extList) ?? ['png', 'webp', 'gif'];
    if (settings.extensions && settings.extensions.filter(it=>it).length <= 0) settings.extensions = ['png', 'webp', 'gif'];
    settings.grayscale = gray ?? (args.reset ? true : settings.grayscale) ?? true;
    settings.mute = mute ?? (args.reset ? true : settings.mute) ?? true;
    settings.isEnabled = true;
    saveMetadataDebounced();
    restart();
    let wasActive = settings.isActive;
    if (wasActive) {
        settings.hide();
    }
    settings.registerSettings();
    await settings.init();
    if (wasActive) {
        settings.show();
    }
};
const deactivate = async () => {
    settings.isEnabled = false;
    saveMetadataDebounced();
    await end();
    let wasActive = settings.isActive;
    if (wasActive) {
        settings.hide();
    }
    settings.registerSettings();
    await settings.init();
    if (wasActive) {
        settings.show();
    }
};
const showHelp = async () => {
    const converter = reloadMarkdownProcessor();
    const readme = await (await fetch('/scripts/extensions/third-party/SillyTavern-TriggerCards/README.md')).text();
    sendSystemMessage('generic', converter.makeHtml(readme).replace(/(src=")(?=[^/])/g, '$1/scripts/extensions/third-party/SillyTavern-TriggerCards/'));
};




const chatChanged = async()=>{
    const context = getContext();
    groupId = context.groupId;
    loadSettings();
    if (settings?.isEnabled) {
        await restart();
    } else {
        await end();
    }
};
eventSource.on(event_types.CHAT_CHANGED, ()=>(chatChanged(),null));




const handleClick = async (/**@type {MouseEvent}*/evt, /**@type {string}*/fullName) => {
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
                    await quickReplyApi.executeQuickReply(settings.memberQrSet, fullName, { name });
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
/**
 * @param {MouseEvent} evt
 * @param {string} fullName
 * @param {HTMLElement} wrap
 */
const handleContext = async(evt, fullName, wrap) => {
    evt.preventDefault();
    evt.stopPropagation();
    wrap.classList.add('sttc--hover');
    const [name, ...args] = fullName.split('::');
    const response = await fetch('/api/plugins/costumes/', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ folder: name, recurse: true }),
    });
    if (!response.ok) {
        wrap.classList.remove('sttc--hover');
        toastr.error(`Failed to retrieve costumes: ${response.status} - ${response.statusText}`);
        return;
    }
    const costumes = await response.json();
    const rect = wrap.getBoundingClientRect();
    const blocker = document.createElement('div'); {
        blocker.classList.add('sttc--blocker');
        const clone = /**@type {HTMLElement}*/(wrap.cloneNode(true)); {
            clone.title = 'Close menu';
            clone.style.top = `${rect.top}px`;
            clone.style.left = `${rect.left}px`;
            clone.addEventListener('click', ()=>{
                blocker.remove();
                wrap.classList.remove('sttc--hover');
            });
            blocker.append(clone);
        }
        const content = document.createElement('div'); {
            content.classList.add('sttc--content');
            content.style.bottom = `calc(100vh - ${rect.top}px - 2em)`;
            const urls = await Promise.all(costumes.map(it=>findImage(it)));
            let i = -1;
            for (const url of urls) {
                i++;
                const costume = costumes[i];
                const cost = document.createElement('div'); {
                    cost.classList.add('sttc--costume');
                    cost.addEventListener('click', ()=>{
                        settings.costumes[fullName] = costume;
                        blocker.remove();
                        wrap.classList.remove('sttc--hover');
                        executeSlashCommandsWithOptions(`/costume ${costume}`);
                        saveMetadataDebounced();
                        restart();
                    });
                    const img = document.createElement('img'); {
                        img.src = url;
                        img.classList.add();
                        cost.append(img);
                    }
                    const lbl = document.createElement('div'); {
                        lbl.classList.add('sttc--label');
                        lbl.textContent = costume.split('/').pop();
                        cost.append(lbl);
                    }
                    content.append(cost);
                }
            }
            blocker.append(content);
        }
        document.body.append(blocker);
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
    titleParts.push('right click to change costume');
    titleParts.splice(1, 0, '-'.repeat(titleParts.reduce((max,cur)=>Math.max(max,cur.length),0) * 1.2));
    el.title = titleParts.join('\n');
};
const getNames = (present = false)=>{
    if (!present) {
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
    }
    if (groupId) {
        const context = getContext();
        const group = context.groups.find(it=>it.id == groupId);
        const members = group.members.map(m=>context.characters.find(c=>c.avatar == m));
        const names = members.map(it=>it.name);
        return names;
    } else {
        return [characters[getContext().characterId]].map(it=>it.name);
    }
};
const getMuted = ()=>{
    if (!groupId) return [];
    const context = getContext();
    const group = context.groups.find(it=>it.id == groupId);
    const members = group.disabled_members.map(m=>context.characters.find(c=>c.avatar == m));
    const names = members.map(it=>it.name);
    return names;
};
const findImage = async (name) => {
  for (const ext of settings.extensions) {
    const url = `/characters/${name}/${settings.expression}.${ext}`;
    const resp = await fetch(url, {
      method: "HEAD",
      headers: getRequestHeaders(),
    });
    if (resp.ok) {
      return url;
    } else {
      const urlThumb = `/thumbnail?type=avatar&file=${name}.${ext}`;
      const respThumb = await fetch(urlThumb, {
        method: "HEAD",
        headers: getRequestHeaders(),
      });
      if (respThumb.ok) {
        return urlThumb;
      }
    }
  }
};
const updateMembers = async() => {
    let expression;
    let extensions;
    while (settings?.isEnabled && isRunning) {
        const names = getNames();
        const present = getNames(true);
        const muted = getMuted();
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
            const namePart = name.split('::')[0];
            if (settings.costumes?.[namePart]) {
                executeSlashCommandsWithOptions(`/costume ${settings.costumes[namePart]}`);
            }
            nameList.push(name);
            const wrap = document.createElement('div'); {
                wrap.classList.add('sttc--wrapper');
                wrap.addEventListener('click', (evt)=>handleClick(evt, name));
                wrap.addEventListener('contextmenu', (evt)=>handleContext(evt, name, wrap));
                wrap.addEventListener('pointerenter', ()=>handleTitle(wrap, name));
                const img = document.createElement('img'); {
                    img.classList.add('sttc--img');
                    img.setAttribute('data-character', name);
                    img.src = await findImage(settings.costumes?.[namePart] ?? namePart);
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
        imgs.forEach(async(img)=>{
            if (settings.grayscale && present.indexOf(img.getAttribute('data-character')) == -1) {
                img.closest('.sttc--wrapper').classList.add('sttc--absent');
            } else {
                img.closest('.sttc--wrapper').classList.remove('sttc--absent');
            }
            if (settings.mute && muted.indexOf(img.getAttribute('data-character')) == -1) {
                img.closest('.sttc--wrapper').classList.add('sttc--chatty');
            } else {
                img.closest('.sttc--wrapper').classList.remove('sttc--chatty');
            }
            if (expression != settings.expression || extensions != settings.extensions.join(', ')) {
                const namePart = img.getAttribute('data-character').split('::')[0];
                img.src = await findImage(settings.costumes?.[namePart] ?? namePart);
            }
        });
        expression = settings.expression;
        extensions = settings.extensions.join(', ');
        await delay(500);
    }
};




const restart = async()=>{
    await end();
    start();
};
const restartDebounced = debounce(restart);
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
