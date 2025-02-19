import { chat_metadata } from '../../../../../script.js';
import { saveMetadataDebounced } from '../../../../extensions.js';
import { delay } from '../../../../utils.js';
import { quickReplyApi } from '../../../quick-reply/index.js';
import { groupId } from '../index.js';
import { ActionSetting } from './settings/ActionSetting.js';
import { BaseSetting } from './settings/BaseSetting.js';
import { CheckboxSetting } from './settings/CheckboxSetting.js';
import { SelectSetting } from './settings/SelectSetting.js';
import { SettingAction } from './settings/SettingAction.js';
import { TextSetting } from './settings/TextSetting.js';

export class Settings {
    /**@type {boolean} */ isEnabled = groupId ? true : false;
    /**@type {string} */ actionQrSet = null;
    /**@type {string} */ memberQrSet = null;
    /**@type {string[]} */ memberList = null;
    /**@type {string} */ expression = 'joy';
    /**@type {string[]} */ extensions = ['png', 'webp', 'gif','jpeg', 'jpg'];
    /**@type {boolean} */ grayscale = true;
    /**@type {boolean} */ mute = true;
    /**@type {{[index:string]:string}} */ costumes = {};

    /**@type {BaseSetting[]}*/ settingList = [];
    get isActive() {
        return this.dom.classList.contains('sttc--active');
    }


    /**@type {()=>void} */ onRestart;


    /**@type {HTMLElement}*/ dom;
    /**@type {HTMLElement}*/ parent;

    constructor() {
        Object.assign(this, chat_metadata.triggerCards ?? {});
        this.registerSettings();
        this.init();
    }

    toJSON() {
        return {
            isEnabled: this.isEnabled,
            actionQrSet: this.actionQrSet,
            memberQrSet: this.memberQrSet,
            memberList: this.memberList,
            expression: this.expression,
            extensions: this.extensions,
            grayscale: this.grayscale,
            mute: this.mute,
            costumes: this.costumes,
        };
    }

    load() {
        Object.assign(this, chat_metadata.triggerCards ?? {});
    }


    registerSettings() {
        while (this.settingList.pop());
        { // general
            this.settingList.push(CheckboxSetting.fromProps({ id: 'sttc--isEnabled',
                name: 'Enable Trigger Cards',
                description: 'Uncheck to disable Trigger Cards in this chat.',
                category: ['General'],
                initialValue: this.isEnabled,
                onChange: (it)=>{
                    this.isEnabled = it.value;
                    this.save(true);
                },
            }));
            this.settingList.push(ActionSetting.fromProps({ id: 'sttc--reset',
                name: 'Reset Settings',
                description: 'Reset all settings for this chat.',
                category: ['General'],
                initialValue: null,
                actionList: [
                    SettingAction.fromProps({ label: 'Reset',
                        icon: 'fa-rotate',
                        tooltip: 'Reset all settings for this chat',
                        action: async()=>{
                            this.hide();
                            Object.assign(this, {
                                isEnabled: groupId ? true : false,
                                actionQrSet: null,
                                memberQrSet: null,
                                memberList: null,
                                expression: 'joy',
                                extensions: ['png', 'webp', 'gif'],
                                grayscale: true,
                                mute: true,
                                costumes: {},
                            });
                            this.registerSettings();
                            await this.init();
                            this.show();
                            this.save(true);
                        },
                    }),
                ],
            }));
        }
        { // actions
            this.settingList.push(SelectSetting.fromProps({ id: 'sttc--actionQrSet',
                name: 'Click Actions',
                description: 'Name of a QR Set for click actions, see /tc?',
                category: ['Actions'],
                initialValue: this.actionQrSet,
                optionList: [{ value:'', label:'-- Default Actions --' }, ...quickReplyApi.listSets().map(it=>({ value:it, label:it }))],
                onChange: (it)=>{
                    this.actionQrSet = it.value;
                    this.save();
                },
            }));
        }
        { // members
            this.settingList.push(SelectSetting.fromProps({ id: 'sttc--memberQrSet',
                name: 'Member QR Set',
                description: 'Name of a QR Set used as member list, see /tc?',
                category: ['Members'],
                initialValue: this.memberQrSet,
                optionList: [{ value:'', label:'-- None --' }, ...quickReplyApi.listSets().map(it=>({ value:it, label:it }))],
                onChange: (it)=>{
                    this.memberQrSet = it.value;
                    this.save();
                },
            }));
            this.settingList.push(TextSetting.fromProps({ id: 'sttc--memberList',
                name: 'Member List',
                description: 'Comma separated list of names to use as member list.',
                category: ['Members'],
                initialValue: (this.memberList ?? []).join(', '),
                onChange: (it)=>{
                    this.memberList = it.value.split(/\s*,\s*/)?.filter(it=>it);
                    this.save();
                },
            }));
        }
        { // images
            this.settingList.push(SelectSetting.fromProps({ id: 'sttc--expression',
                name: 'Expressions',
                description: 'Character expression to use for trigger card.',
                category: ['Images'],
                initialValue: this.expression,
                optionList: [
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
                ].map(it=>({ value:it, label:it })),
                onChange: (it)=>{
                    this.expression = it.value;
                    this.save();
                },
            }));
            this.settingList.push(TextSetting.fromProps({ id: 'sttc--extensions',
                name: 'Extensions',
                description: 'Comma separated list of file extensions to use for expression images.',
                category: ['Images'],
                initialValue: (this.extensions ?? []).join(', '),
                onChange: (it)=>{
                    this.extensions = it.value.split(/\s*,\s*/)?.filter(it=>it);
                    this.save();
                },
            }));
            this.settingList.push(CheckboxSetting.fromProps({ id: 'sttc--grayscale',
                name: 'Absent Grayscale',
                description: 'Show absent members desaturated.',
                category: ['Images'],
                initialValue: this.grayscale,
                onChange: (it)=>{
                    this.grayscale = it.value;
                    this.save();
                },
            }));
            this.settingList.push(CheckboxSetting.fromProps({ id: 'sttc--mute',
                name: 'Highlight Unmuted',
                description: 'Show unmuted members opaque.',
                category: ['Images'],
                initialValue: this.mute,
                onChange: (it)=>{
                    this.mute = it.value;
                    this.save();
                },
            }));
        }
    }

    save(isRestart = false) {
        saveMetadataDebounced();
        if (isRestart) {
            this.onRestart?.();
        }
    }

    async init() {
        const response = await fetch('/scripts/extensions/third-party/SillyTavern-TriggerCards/html/settings.html');
        if (!response.ok) {
            return console.warn('failed to fetch template: sttc--settings.html');
        }
        const settingsTpl = document
            .createRange()
            .createContextualFragment(await response.text())
            .querySelector('#sttc--settings-v2')
        ;
        const dom = /**@type {HTMLElement} */(settingsTpl.cloneNode(true));
        this.dom = dom;

        dom.querySelector('#sttc--settings-close').addEventListener('click', ()=>{
            this.hide();
        });
        dom.querySelector('.contentWrapper').addEventListener('scroll', ()=>this.updateCategory());

        const search = /**@type {HTMLInputElement}*/(dom.querySelector('.search'));
        search.addEventListener('input', ()=>{
            const query = search.value.trim().toLowerCase();
            for (const setting of this.settingList) {
                if (setting.name.toLowerCase().includes(query) || setting.description.toLowerCase().includes(query)) {
                    setting.dom.classList.remove('hidden');
                } else {
                    setting.dom.classList.add('hidden');
                }
            }
            const cats = [...dom.querySelectorAll('.contentWrapper .category:has(.item:not(.hidden)) > .head')].map(it=>it.textContent);
            const heads = [...dom.querySelectorAll('.categoriesWrapper .category .head')];
            for (const head of heads) {
                if (cats.includes(head.textContent)) {
                    head.classList.remove('hidden');
                } else {
                    head.classList.add('hidden');
                }
            }
            this.updateCategory();
        });

        // build tree
        const tree = {};
        for (const setting of this.settingList) {
            let cur = tree;
            for (const key of setting.category) {
                if (!cur[key]) {
                    cur[key] = { name:key, settings:[] };
                }
                cur = cur[key];
            }
            cur.settings.push(setting);
        }

        // render tree
        const catRoot = /**@type {HTMLElement}*/(dom.querySelector('.categoriesWrapper'));
        const contRoot = /**@type {HTMLElement}*/(dom.querySelector('.contentWrapper'));
        const render = (cat, cont, cur, level = 0)=>{
            for (const key of Object.keys(cur)) {
                if (['name', 'settings'].includes(key)) continue;
                const curCat = cur[key];
                const block = document.createElement('div'); {
                    block.classList.add('category');
                    const head = document.createElement('div'); {
                        head.classList.add('head');
                        head.setAttribute('data-level', level.toString());
                        head.textContent = key;
                        block.append(head);
                    }
                }
                const catBlock = /**@type {HTMLElement}*/(block.cloneNode(true));
                catBlock.querySelector('.head').addEventListener('click', ()=>{
                    let offset = 0;
                    let head = /**@type {HTMLElement}*/(block.querySelector('.head'));
                    head = head.closest('.category').parentElement.closest('.category')?.querySelector('.head');
                    while (head) {
                        offset += head.offsetHeight;
                        head = head.closest('.category').parentElement.closest('.category')?.querySelector('.head');
                    }
                    contRoot.scrollTo({
                        top: block.offsetTop - offset,
                        behavior: 'smooth',
                    });
                });
                cat.append(catBlock);
                cont.append(block);
                for (const setting of curCat.settings) {
                    const item = setting.render();
                    block.append(item);
                }
                render(catBlock, block, curCat, level + 1);
            }
        };
        render(catRoot, contRoot, tree);
    }


    updateCategory() {
        const wrapRect = this.dom.querySelector('.contentWrapper').getBoundingClientRect();
        for (const setting of this.settingList) {
            const rect = setting.dom.getBoundingClientRect();
            if (rect.top > wrapRect.top || rect.top < wrapRect.top && rect.bottom > wrapRect.top + wrapRect.height / 4) {
                const cat = setting.dom.closest('.category').querySelector('.head').textContent;
                const heads = [...this.dom.querySelectorAll('.categoriesWrapper .head')];
                for (const head of heads) {
                    if (head.textContent == cat) {
                        let cur = head;
                        cur.classList.add('current');
                        while (cur) {
                            cur = cur.closest('.category').parentElement.closest('.category')?.querySelector('.head');
                            cur?.classList?.add('current');
                        }
                    } else {
                        head.classList.remove('current');
                    }
                }
                return;
            }
        }
    }

    async show(parent = document.body) {
        if (this.parent != parent) {
            this.parent = parent;
            parent.addEventListener('keydown', (evt)=>{
                if (!this.dom.classList.contains('sttc--active')) return;
                const query = this.dom.querySelector('.search');
                const rect = query.getBoundingClientRect();
                if (document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) != query) return;
                if (evt.ctrlKey && evt.key == 'f') {
                    evt.preventDefault();
                    evt.stopPropagation();
                    this.dom.querySelector('.search').select();
                }
            });
        }
        parent.append(this.dom);
        this.dom.classList.add('sttc--active');
        this.dom.style.bottom = `calc(100dvh + 50px - ${document.querySelector('#form_sheld').getBoundingClientRect().top}px`;
        await delay(200);
        this.updateCategory();
        this.dom.querySelector('.search').select();
    }
    hide() {
        this.dom.classList.remove('sttc--active');
        this.dom.remove();
    }
    async toggle(parent) {
        if (this.isActive) {
            this.hide();
        } else {
            await this.show(parent);
        }
    }
}
