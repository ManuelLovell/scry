import OBR, { Image } from '@owlbear-rodeo/sdk'
import { ViewportFunctions } from './viewport';
import * as Utilities from "./utilities";
import Fuse from 'fuse.js';
import './style.css'
import { Constants } from './constants';

let sceneItems: any[] = [];
let storedMetadata: any[] = [];
let locked = false;
let role: string;
const appWindow = document.querySelector<HTMLDivElement>('#app')!
const lockWindow = document.querySelector<HTMLDivElement>('#locked')!

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `<div id="startup">Awaiting scene...</div>`;

OBR.onReady(async () =>
{
    // Set theme accordingly
    const theme = await OBR.theme.getTheme();
    Utilities.SetThemeMode(theme, document);
    OBR.theme.onChange((theme) =>
    {
        Utilities.SetThemeMode(theme, document);
    });
    const sceneReady = await OBR.scene.isReady();
    if (sceneReady)
    {
        await SetupForm();
    }

    role = await OBR.player.getRole();
    OBR.scene.onReadyChange(async (ready: boolean) =>
    {
        if (ready)
        {
            await SetupForm();
        }
        else
        {
            document.querySelector<HTMLDivElement>('#app')!.innerHTML = `<div id="startup">Awaiting Scene..</div>`;
        }
    });

    OBR.scene.onMetadataChange(async (metadata) =>
    {
        storedMetadata = metadata[`${Constants.EXTENSIONID}/stored`] as [];
        if (!storedMetadata) storedMetadata = [];
        
        const checkLock = metadata[`${Constants.EXTENSIONID}/locked`] as boolean;
        locked = checkLock ? true : false;
        if (role === "PLAYER")
        {
            if (locked)
            {
                appWindow.hidden = true;
                appWindow.style.display = "none";
                lockWindow.hidden = false;
                await OBR.action.setHeight(50);
            }
            else
            {
                appWindow.hidden = false;
                appWindow.style.display = "flex";
                lockWindow.hidden = true;
                await OBR.action.setHeight(300);
            }
        }
    });

    OBR.scene.items.onChange((bItems) =>
    {
        const items = bItems as Image[];
        FilterItems(items);
    });
});

async function SetupForm(): Promise<void>
{
    await FilterItems(await OBR.scene.items.getItems());
    document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
        <div id="counter" class="count"></div>
        ${role === "GM" ? '<div id="toggler" class="toggler"></div>' : ''}
        <div class="wrapper">
        <div id="bannerText"></div>
            <input type="text" id="searchBar" class="${role === 'GM' ? '' : 'player'}searchBar" onkeyup="StartSearch()" placeholder="Search for..">
            <button id="clearSearch" class="${role === 'GM' ? '' : 'player'}clear">X</button>
        </div>
        <div class="scrollable">
            <ol id="searchList"></ol>
        </div>
    `;

    ///Scrolling News
    const textArray = [
        "Added 'ALL' and 'EVERYTHING' to search.",
        "Scry! v1.2",
        "Use 'ID:' as a prefix to an ID to search IDs",
        "Widened search area",
        "Click Lock to disable Player Search",
    ];

    let currentIndex = 0;
    const textContainer = document.getElementById("bannerText")!;

    function fadeOut()
    {
        textContainer.style.opacity = "0";
        setTimeout(() =>
        {
            fadeIn();
        }, 2000); // Fade-out time is 2 seconds
    }

    function fadeIn()
    {
        currentIndex = (currentIndex + 1) % textArray.length;
        textContainer.textContent = textArray[currentIndex];
        textContainer.style.opacity = "1";
        setTimeout(() =>
        {
            fadeOut();
        }, 10000); // Fade-in time is 2 seconds
    }
    ///Scrolling News

    // Initial display
    textContainer.textContent = textArray[currentIndex];
    fadeIn();

    const searchList = document.getElementById("searchList") as HTMLUListElement;
    const searchInput = document.getElementById("searchBar") as HTMLInputElement;
    const countElement = document.getElementById("counter")! as HTMLDivElement;
    const toggleElement = document.getElementById("toggler")! as HTMLDivElement;
    countElement.innerText = "...";
    countElement.title = "Number of Results";
    const clearButton = document.getElementById("clearSearch") as HTMLButtonElement;

    if (role === "GM")
    {
        const playerToggle = document.createElement('input');
        playerToggle.type = "image";
        playerToggle.title = "Disable Player Access";
        playerToggle.className = "toggleClickable";
        playerToggle.value = locked ? "on" : "off";
        playerToggle.onclick = async function (event: Event)
        {
            event.stopPropagation();
            if (playerToggle.value === "off")
            {
                playerToggle.value = "on";
                playerToggle.src = "/lock.svg";
                await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/locked`]: true });
            }
            else
            {
    
                playerToggle.value = "off";
                playerToggle.src = "/unlock.svg";
                await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/locked`]: false });
    
            }
        };
        playerToggle.src = locked ? "/lock.svg" : "/unlock.svg";
        toggleElement.appendChild(playerToggle);
    }

    clearButton.title = "Clear Search";
    clearButton.onclick = () =>
    {
        searchInput.value = "";
        searchList.innerHTML = "";
        countElement.innerText = "...";
    };

    searchInput.onkeyup = () =>
    {
        const searchTerm = searchInput.value.toUpperCase();
        let term = searchInput.value.toUpperCase();
        if (!term || term.length < 2)
        {
            countElement.innerText = "...";
            return searchList.innerHTML = "";
        }

        let foundItems: any[] = [];
        if (searchTerm === "ALL" || searchTerm === "EVERYTHING")
        {
            foundItems = sceneItems.map(val => ({
                item: Object.assign(val, {}),
                matches: [],
                score: 1
            }));
        }
        else if (searchTerm.substring(0, 3) === "ID:")
        {
            term = term.substring(3);
            const fuse = new Fuse(sceneItems, { threshold: 0.0, includeScore: true, keys: ['secretIdentity'] });
            foundItems = fuse.search(term);
        }
        else
        {
            // Filter out busy layers on normal searching
            const filteredItems = sceneItems.filter((item) =>
                item.layer == "ATTACHMENT"
                || item.layer == "CHARACTER"
                || item.layer == "PROP"
                || item.layer == "MOUNT"
                || item.layer == "MAP"
                || item.layer == "TEXT");

            const fuse = new Fuse(filteredItems, { threshold: 0.4, includeScore: true, keys: ['name', 'customTextName'] });
            foundItems = fuse.search(term);
        }

        searchList.innerHTML = "";
        countElement.innerText = "...";
        let increment = 1;
        let foundBase = 0;

        if (foundItems.length > 0)
        {
            foundBase = role === "GM" ? foundItems.length : foundItems.filter(item => item.item.visible === true).length;
            countElement.innerText = foundBase.toString();

            for (const fuseItem of foundItems)
            {
                if (fuseItem.item.visible === false && role !== "GM") continue;

                const listItem = document.createElement("li");
                let trueName = fuseItem.item.name.toUpperCase().includes(term) ? "" : ` (${fuseItem.item.customTextName})`;
                if (trueName === " ()" || trueName === ' (undefined)') trueName = "";

                listItem.id = "li-" + fuseItem.item.id;
                listItem.innerHTML = `${increment}.   ${fuseItem.item.name}${trueName}${fuseItem.item.visible ? "" : " (Hidden)"}`;
                listItem.title = fuseItem.item.secretIdentity;

                const div = document.createElement('div');
                div.className = "listdiv";

                if (role === "GM")
                {
                    const vanishButton = document.createElement('input');
                    vanishButton.type = "image";
                    vanishButton.title = "Vanish this Item";
                    vanishButton.className = "clickable";
                    vanishButton.value = "off";
                    vanishButton.onclick = async function (event: Event)
                    {
                        event.stopPropagation();
                        if (vanishButton.value === "off")
                        {
                            await OBR.player.deselect([fuseItem.item.id]);

                            // Get the item fresh from OBR, or it'll be snapshot from the search
                            const freshItem = await OBR.scene.items.getItems([fuseItem.item.id]);
                            if (freshItem.length > 0)
                            {
                                const fItem = freshItem[0] as any;

                                // Add custom fields to search on when Vanished
                                fItem.secretIdentity = fItem.id;
                                if (fItem.text?.plainText)
                                {
                                    fItem.customTextName = fItem.text.plainText;
                                }

                                storedMetadata.push(fItem);
                                await OBR.scene.items.deleteItems([fuseItem.item.id]);
                                vanishButton.value = "on";
                                vanishButton.src = "/eyeclosed.svg";

                                await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/stored`]: storedMetadata });
                            }

                        }
                        else
                        {
                            const freshlyStored = storedMetadata.find(x => x.id === fuseItem.item.id);
                            if (freshlyStored)
                            {
                                delete freshlyStored.customTextName;
                                delete freshlyStored.secretIdentity;

                                await OBR.scene.items.addItems([freshlyStored]);
                                storedMetadata = storedMetadata.filter(x => x.id !== fuseItem.item.id);
                                vanishButton.value = "off";
                                vanishButton.src = "/eyeopen.svg";

                                await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/stored`]: storedMetadata });
                            }
                        }
                    };
                    vanishButton.src = "/eyeopen.svg";

                    const trashButton = document.createElement('input');
                    trashButton.type = "image";
                    trashButton.title = "Delete this Item";
                    trashButton.className = "clickable";
                    trashButton.src = "/trash.svg";
                    trashButton.onclick = async function (event: Event)
                    {
                        event.stopPropagation();
                        await OBR.scene.items.deleteItems([fuseItem.item.id]);
                        storedMetadata = storedMetadata.filter(x => x.id !== fuseItem.item.id);

                        await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/stored`]: storedMetadata });

                        listItem.remove();
                        countElement.innerText = (+countElement.innerText - 1).toString();
                    }
                    div.appendChild(trashButton);
                    div.appendChild(vanishButton);
                }

                listItem.appendChild(div);

                listItem.onclick = async () =>
                {
                    ViewportFunctions.CenterViewportOnImage(fuseItem.item);
                    await OBR.player.select([fuseItem.item.id]);
                };
                searchList.appendChild(listItem);
                increment++;
            }
        }

        if (role === "GM")
        {
            // For the vanished cache
            let vFoundItems: any[] = [];
            if (searchTerm === "ALL" || searchTerm === "EVERYTHING")
            {
                vFoundItems = storedMetadata.map(val => ({
                    item: Object.assign(val, {}),
                    matches: [],
                    score: 1
                }));
            }
            else if (searchTerm.substring(0, 3) === "ID:")
            {
                const vFuse = new Fuse(storedMetadata, { threshold: 0.0, includeScore: true, keys: ['secretIdentity'] });
                vFoundItems = vFuse.search(term);
            }
            else
            {
                const vFuse = new Fuse(storedMetadata, { threshold: 0.4, includeScore: true, keys: ['name', 'customTextName'] });
                vFoundItems = vFuse.search(term);
            }

            if (vFoundItems.length > 0)
            {
                const visibleCount = role === "GM" ? vFoundItems.length : vFoundItems.filter(item => item.item.visible === true).length;
                countElement.innerText = foundBase > 0 ? (foundBase + visibleCount).toString() : visibleCount.toString();

                for (const vFuseItem of vFoundItems)
                {
                    if (vFuseItem.item.visible === false && role !== "GM") continue;

                    const listItem = document.createElement("li");
                    let trueName = vFuseItem.item.name.toUpperCase().includes(term) ? "" : ` (${vFuseItem.item.text?.plainText})`;
                    if (trueName === " ()" || trueName === ' (undefined)') trueName = "";

                    listItem.id = "li-" + vFuseItem.item.id;
                    listItem.innerHTML = `${increment}.   ${vFuseItem.item.name}${trueName}${vFuseItem.item.visible ? "" : " (Hidden)"}`;

                    const vanishButton = document.createElement('input');
                    vanishButton.type = "image";
                    vanishButton.title = "Restore this Item";
                    vanishButton.className = "clickable";
                    vanishButton.value = "off";
                    vanishButton.onclick = async function (event: Event)
                    {
                        event.stopPropagation();
                        if (vanishButton.value === "off")
                        {
                            delete vFuseItem.item.customTextName;
                            delete vFuseItem.item.secretIdentity;

                            await OBR.scene.items.addItems([vFuseItem.item]);
                            storedMetadata = storedMetadata.filter(x => x.id !== vFuseItem.item.id);
                            vanishButton.src = "/eyeopen.svg";
                            vanishButton.value = "on";

                            await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/stored`]: storedMetadata });
                        }
                        else
                        {
                            // Get the item fresh from OBR, or it'll be snapshot from the search
                            const freshItem = await OBR.scene.items.getItems([vFuseItem.item.id]);
                            if (freshItem.length > 0)
                            {
                                const fItem = freshItem[0] as any;

                                // Add custom fields to search on when Vanished
                                fItem.secretIdentity = fItem.id;
                                if (fItem.text?.plainText)
                                {
                                    fItem.customTextName = fItem.text.plainText;
                                }
                                storedMetadata.push(fItem);
                                await OBR.player.deselect([vFuseItem.item.id]);
                                await OBR.scene.items.deleteItems([vFuseItem.item.id]);
                                vanishButton.value = "off";
                                vanishButton.src = "/eyeclosed.svg";

                                await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/stored`]: storedMetadata });
                            }
                        }
                    };
                    vanishButton.src = "/eyeclosed.svg";

                    const trashButton = document.createElement('input');
                    trashButton.type = "image";
                    trashButton.title = "Delete this Item";
                    trashButton.className = "clickable";
                    trashButton.src = "/trash.svg";
                    trashButton.onclick = async function (event: Event)
                    {
                        event.stopPropagation();
                        await OBR.scene.items.deleteItems([vFuseItem.item.id]);
                        storedMetadata = storedMetadata.filter(x => x.id !== vFuseItem.item.id);

                        await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/stored`]: storedMetadata });

                        listItem.remove();
                        countElement.innerText = (+countElement.innerText - 1).toString();
                    }
                    const div = document.createElement('div');
                    div.className = "listdiv";
                    div.appendChild(trashButton);
                    div.appendChild(vanishButton);
                    listItem.appendChild(div);

                    listItem.onclick = async () =>
                    {
                        ViewportFunctions.CenterViewportOnImage(vFuseItem.item);
                        await OBR.player.select([vFuseItem.item.id]);
                    };
                    searchList.appendChild(listItem);
                    increment++;
                }
            }
        }
    }
}

async function FilterItems(items: Image[])
{
    const customItems = [];
    for (const item of items)
    {
        let anyItem = item as any;
        anyItem.secretIdentity = item.id;
        if (item.text?.plainText)
        {
            anyItem.customTextName = item.text.plainText;
        }
        customItems.push(anyItem);
    }
    sceneItems = customItems;
}