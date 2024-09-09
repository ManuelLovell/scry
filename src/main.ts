import OBR from '@owlbear-rodeo/sdk'
import Fuse from 'fuse.js';
import * as Utilities from './bsUtilities';
import { ViewportFunctions } from './viewport';
import { Constants } from './constants';
import { BSCACHE } from './bsSceneCache';
import './style.css'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `<div id="startup">Awaiting scene...</div>`;

OBR.onReady(async () =>
{
    await BSCACHE.InitializeCache();
    setTimeout(async () =>
    {
        if (BSCACHE.sceneReady === false) await BSCACHE.InitializeCache();
        BSCACHE.SetupHandlers();

        if (BSCACHE.sceneReady)
        {
            await SetupForm();
        }
    }, 1000);
});

export async function SetupForm(): Promise<void>
{
    if (BSCACHE.playerRole === 'GM')
        {
            document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
            <table>
                <colgroup>
                    <col style="width: 40%;">  
                    <col style="width: 20%;">  
                    <col style="width: 20%;">  
                    <col style="width: 10%;">  
                    <col style="width: 10%;">  
                </colgroup>
                <tr>
                    <td colspan="4"><div id="header">Scry!</div></td>
                    <td><div id="patreonContainer"></div></td>
                </tr>
                <tr>
                    <td colspan="3">
                        <div style="display:flex;">
                            <div class="wrapper">
                                <input type="text" id="searchBar" class="searchBar" onkeyup="StartSearch()" placeholder="Search for..">
                                <button id="clearSearch" class="clear">X</button>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div id="toggler" class="toggler"></div>
                    </td>
                    <td>
                        <div id="counter" class="count"></div>
                    </td>
                </tr>
                <tr>
                    <td colspan="5">
                        <div class="scrollable">
                            <ol id="searchList"></ol>
                        </div>
                    </td>
                </tr>
            </table>
        `;
        }
        else
        {
            document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
            <table>
                <colgroup>
                    <col style="width: 40%;">  
                    <col style="width: 20%;">  
                    <col style="width: 20%;">  
                    <col style="width: 10%;">  
                    <col style="width: 10%;">  
                </colgroup>
                <tr>
                    <td colspan="4"><div id="header">Scry!</div></td>
                    <td><div id="patreonContainer"></div></td>
                </tr>
                <tr>
                    <td colspan="4">
                        <div style="display:flex;">
                            <div class="wrapper">
                                <input type="text" id="searchBar" class="playersearchBar" onkeyup="StartSearch()" placeholder="Search for..">
                                <button id="clearSearch" class="playerclear">X</button>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div id="counter" class="count"></div>
                    </td>
                </tr>
                <tr>
                    <td colspan="5">
                        <div class="scrollable">
                            <ol id="searchList"></ol>
                        </div>
                    </td>
                </tr>
            </table>
        `;
        }
    

    const searchList = document.getElementById("searchList") as HTMLUListElement;
    const searchInput = document.getElementById("searchBar") as HTMLInputElement;
    const countElement = document.getElementById("counter")! as HTMLDivElement;
    const toggleElement = document.getElementById("toggler")! as HTMLDivElement;
    countElement.innerText = "...";
    countElement.title = "Number of Results";
    const clearButton = document.getElementById("clearSearch") as HTMLButtonElement;

    if (BSCACHE.playerRole === "GM")
    {
        const playerToggle = document.createElement('input');
        playerToggle.type = "image";
        playerToggle.title = "Disable Player Access";
        playerToggle.className = "toggleClickable";
        playerToggle.value = BSCACHE.locked ? "on" : "off";
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
        playerToggle.src = BSCACHE.locked ? "/lock.svg" : "/unlock.svg";
        toggleElement.appendChild(playerToggle);
    }

    clearButton.title = "Clear Search";
    clearButton.onclick = () =>
    {
        searchInput.value = "";
        searchList.innerHTML = "";
        countElement.innerText = "...";
    };

    const patreonContainer = document.getElementById("patreonContainer") as HTMLDivElement;
    patreonContainer.appendChild(Utilities.GetPatreonButton());

    searchInput.onkeyup = () =>
    {
        const normalizedSearchTerm = searchInput.value.toUpperCase().trim();

        // Check if search term is too short or empty
        if (!normalizedSearchTerm || normalizedSearchTerm.length < 2)
        {
            countElement.innerText = "..."; // Update count element text as needed
            return searchList.innerHTML = ""; // Clear search list
        }

        // Extract search prefix and term
        const [prefix, term] = extractPrefixAndTerm(normalizedSearchTerm);

        let foundItems: any[] = [];

        // Handle different search prefixes
        switch (prefix)
        {
            case "ALL":
            case "EVERYTHING":
                foundItems = BSCACHE.sceneItems.map(val => ({
                    item: { ...val }, // Copy item properties using spread operator
                    matches: [],
                    score: 1
                }));
                break;
            case "ID":
                foundItems = performSearch(BSCACHE.sceneItems, term, ['secretIdentity']);
                break;
            case "MAP":
            case "PROP":
            case "MOUNT":
            case "CHARACTER":
            case "ATTACHMENT":
            case "NOTE":
            case "FOG":
            case "TEXT":
                const filteredItems = BSCACHE.sceneItems.filter(item => item.layer === prefix);
                if (!term)
                {
                    foundItems = filteredItems.map(val => ({
                        item: { ...val }, // Copy item properties using spread operator
                        matches: [],
                        score: 1
                    }));
                }
                else
                {
                    foundItems = performSearch(filteredItems, term, ['name', 'customTextName'], 0.4);
                }
                break;
            default:
                // Default case for unknown prefixes (e.g., handle 'NORMAL' search)
                const validLayers = ["ATTACHMENT", "CHARACTER", "PROP", "MOUNT", "MAP", "TEXT"];
                const allFilteredItems = BSCACHE.sceneItems.filter(item => validLayers.includes(item.layer));
                foundItems = performSearch(allFilteredItems, term, ['name', 'customTextName'], 0.4);
                break;
        }

        searchList.innerHTML = "";
        countElement.innerText = "...";
        let increment = 1;
        let foundBase = 0;

        if (foundItems.length > 0)
        {
            foundBase = BSCACHE.playerRole === "GM" ? foundItems.length : foundItems.filter(item => item.item.visible === true).length;
            countElement.innerText = foundBase.toString();

            for (const fuseItem of foundItems)
            {
                if (fuseItem.item.visible === false && BSCACHE.playerRole !== "GM") continue;

                const listItem = document.createElement("li");
                let trueName = fuseItem.item.name.toUpperCase().includes(term) ? "" : ` (${fuseItem.item.customTextName})`;
                if (trueName === " ()" || trueName === ' (undefined)') trueName = "";

                listItem.id = "li-" + fuseItem.item.id;
                listItem.innerHTML = `${increment}.   ${fuseItem.item.name}${trueName}${fuseItem.item.visible ? "" : " (Hidden)"}`;
                listItem.title = fuseItem.item.secretIdentity;

                const div = document.createElement('div');
                div.className = "listdiv";

                if (BSCACHE.playerRole === "GM")
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

                                BSCACHE.storedMetaItems.push(fItem);
                                await OBR.scene.items.deleteItems([fuseItem.item.id]);
                                vanishButton.value = "on";
                                vanishButton.src = "/eyeclosed.svg";

                                await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/stored`]: BSCACHE.storedMetaItems });
                            }

                        }
                        else
                        {
                            const freshlyStored = BSCACHE.storedMetaItems.find(x => x.id === fuseItem.item.id) as any;
                            if (freshlyStored)
                            {
                                delete freshlyStored.customTextName;
                                delete freshlyStored.secretIdentity;

                                await OBR.scene.items.addItems([freshlyStored]);
                                BSCACHE.storedMetaItems = BSCACHE.storedMetaItems.filter(x => x.id !== fuseItem.item.id);
                                vanishButton.value = "off";
                                vanishButton.src = "/eyeopen.svg";

                                await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/stored`]: BSCACHE.storedMetaItems });
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
                        BSCACHE.storedMetaItems = BSCACHE.storedMetaItems.filter(x => x.id !== fuseItem.item.id);

                        await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/stored`]: BSCACHE.storedMetaItems });

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

        if (BSCACHE.playerRole === "GM")
        {
            // For the vanished cache
            let vFoundItems: any[] = [];
            switch (prefix)
            {
                case "ALL":
                case "EVERYTHING":
                    vFoundItems = BSCACHE.storedMetaItems.map(val => ({
                        item: { ...val }, // Copy item properties using spread operator
                        matches: [],
                        score: 1
                    }));
                    break;
                case "ID":
                    vFoundItems = performSearch(BSCACHE.storedMetaItems, term, ['secretIdentity']);
                    break;
                case "MAP":
                case "PROP":
                case "MOUNT":
                case "CHARACTER":
                case "ATTACHMENT":
                case "NOTE":
                case "FOG":
                case "TEXT":
                    const vfilteredItems = BSCACHE.storedMetaItems.filter(item => item.layer === prefix);
                    if (!term)
                    {
                        vFoundItems = vfilteredItems.map(val => ({
                            item: { ...val }, // Copy item properties using spread operator
                            matches: [],
                            score: 1
                        }));
                    }
                    else
                    {
                        vFoundItems = performSearch(vfilteredItems, term, ['name', 'customTextName'], 0.4);
                    }
                    break;
                default:
                    // Default case for unknown prefixes (e.g., handle 'NORMAL' search)
                    const validLayers = ["ATTACHMENT", "CHARACTER", "PROP", "MOUNT", "MAP", "TEXT"];
                    const vAllFilteredItems = BSCACHE.storedMetaItems.filter(item => validLayers.includes(item.layer));
                    vFoundItems = performSearch(vAllFilteredItems, term, ['name', 'customTextName'], 0.4);
                    break;
            }

            if (vFoundItems.length > 0)
            {
                const visibleCount = BSCACHE.playerRole === "GM" ? vFoundItems.length : vFoundItems.filter(item => item.item.visible === true).length;
                countElement.innerText = foundBase > 0 ? (foundBase + visibleCount).toString() : visibleCount.toString();

                for (const vFuseItem of vFoundItems)
                {
                    if (vFuseItem.item.visible === false && BSCACHE.playerRole !== "GM") continue;

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
                            BSCACHE.storedMetaItems = BSCACHE.storedMetaItems.filter(x => x.id !== vFuseItem.item.id);
                            vanishButton.src = "/eyeopen.svg";
                            vanishButton.value = "on";

                            await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/stored`]: BSCACHE.storedMetaItems });
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
                                BSCACHE.storedMetaItems.push(fItem);
                                await OBR.player.deselect([vFuseItem.item.id]);
                                await OBR.scene.items.deleteItems([vFuseItem.item.id]);
                                vanishButton.value = "off";
                                vanishButton.src = "/eyeclosed.svg";

                                await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/stored`]: BSCACHE.storedMetaItems });
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
                        BSCACHE.storedMetaItems = BSCACHE.storedMetaItems.filter(x => x.id !== vFuseItem.item.id);

                        await OBR.scene.setMetadata({ [`${Constants.EXTENSIONID}/stored`]: BSCACHE.storedMetaItems });

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

        function extractPrefixAndTerm(searchTerm: string): [string, string]
        {
            const prefixLength = searchTerm.indexOf(':');
            if (prefixLength !== -1)
            {
                const prefix = searchTerm.substring(0, prefixLength);
                const term = searchTerm.substring(prefixLength + 1);
                return [prefix, term];
            }
            return ["", searchTerm];
        }

        function performSearch(items: any[], term: string, keys: string[], threshold = 0.0): any[]
        {
            const fuse = new Fuse(items, { threshold, includeScore: true, keys });
            return fuse.search(term);
        }
    }
}