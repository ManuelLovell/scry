import OBR, { Image } from '@owlbear-rodeo/sdk'
import { ViewportFunctions } from './viewport';
import * as Utilities from "./utilities";
import Fuse from 'fuse.js';
import './style.css'
import { Constants } from './constants';

let sceneItems: any[] = [];
let storedItems: any[] = [];
let role: string;

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
    OBR.scene.onReadyChange(async (ready) =>
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
        <div class="wrapper">
        <div id="bannerText"></div>
            <input type="text" id="searchBar" onkeyup="StartSearch()" placeholder="Search for..">
            <button id="clearSearch" class="clear">X</button>
        </div>
        <div class="scrollable">
            <ol id="searchList"></ol>
        </div>
    `;

    ///Scrolling News
    const textArray = [
        "Scry! v1.1",
        "'Vanish' button temp-removes assets.",
        "'Trash' is just another delete.",
        "Fixed player Vanish/Delete permissions."];

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
    countElement.innerText = "...";
    const clearButton = document.getElementById("clearSearch") as HTMLButtonElement;

    clearButton.onclick = () =>
    {
        searchInput.value = "";
        searchList.innerHTML = "";
        countElement.innerText = "...";
    };

    searchInput.onkeyup = () =>
    {
        try
        {
            const stored = localStorage.getItem(Constants.SCRYKEY);
            if (stored)
            {
                const unwrapped: any[] = JSON.parse(stored);
                storedItems = unwrapped;
            }

        } catch (error)
        {
            console.log("Unable to retrieve VanishedItems from local storage.");
        }
        const term = searchInput.value.toUpperCase();
        if (!term || term.length < 2)
        {
            countElement.innerText = "...";
            return searchList.innerHTML = "";
        }

        searchList.innerHTML = "";
        countElement.innerText = "...";
        let increment = 1;
        let foundBase = 0;

        const fuse = new Fuse(sceneItems, { threshold: 0.4, includeScore: true, keys: ['name', 'customTextName'] });
        const foundItems = fuse.search(term);

        if (foundItems.length > 0)
        {
            foundBase = role === "GM" ? foundItems.length : foundItems.filter(item => item.item.visible === true).length;
            countElement.innerText = foundBase.toString();

            for (const fuseItem of foundItems)
            {
                if (fuseItem.item.visible === false && role !== "GM") continue;

                const listItem = document.createElement("li");
                let trueName = fuseItem.item.name.toUpperCase().includes(term) ? "" : ` (${fuseItem.item.customTextName})`;
                if (trueName == " ()") trueName = "";

                listItem.id = "li-" + fuseItem.item.id;
                listItem.innerHTML = `${increment}.   ${fuseItem.item.name}${trueName}${fuseItem.item.visible ? "" : " (Hidden)"}`;

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
                            //await OBR.player.deselect([fuseItem.item.id]);

                            // Get the item fresh from OBR, or it'll be snapshot from the search
                            const freshItem = await OBR.scene.items.getItems([fuseItem.item.id]);
                            if (freshItem.length > 0)
                            {
                                storedItems.push(freshItem[0]);
                                await OBR.scene.items.deleteItems([fuseItem.item.id]);
                                vanishButton.value = "on";
                                vanishButton.src = "/eyeclosed.svg";

                                try
                                {
                                    const json = JSON.stringify(storedItems);
                                    localStorage.setItem(Constants.SCRYKEY, json);
                                }
                                catch (error)
                                {
                                    console.log("Cannot save Vanished Items to localstorage, may lose on refresh");
                                }
                            }

                        }
                        else
                        {
                            const freshlyStored = storedItems.find(x => x.id === fuseItem.item.id);
                            if (freshlyStored)
                            {
                                delete freshlyStored.customTextName;

                                await OBR.scene.items.addItems([freshlyStored]);
                                storedItems = storedItems.filter(x => x.id !== fuseItem.item.id);
                                vanishButton.value = "off";
                                vanishButton.src = "/eyeopen.svg";

                                try
                                {
                                    const json = JSON.stringify(storedItems);
                                    localStorage.setItem(Constants.SCRYKEY, json);
                                }
                                catch (error)
                                {
                                    console.log("Cannot save Vanished Items to localstorage, may lose on refresh");
                                }
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
                        storedItems = storedItems.filter(x => x.id !== fuseItem.item.id);
                        try
                        {
                            const json = JSON.stringify(storedItems);
                            localStorage.setItem(Constants.SCRYKEY, json);
                        }
                        catch (error)
                        {
                            console.log("Cannot save Vanished Items to localstorage, may lose on refresh");
                        }
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
            const vFuse = new Fuse(storedItems, { threshold: 0.4, includeScore: true, keys: ['name', 'customTextName'] });
            const vFoundItems = vFuse.search(term);

            if (vFoundItems.length > 0)
            {
                const visibleCount = role === "GM" ? vFoundItems.length : vFoundItems.filter(item => item.item.visible === true).length;
                countElement.innerText = foundBase > 0 ? (foundBase + visibleCount).toString() : visibleCount.toString();

                for (const vFuseItem of vFoundItems)
                {
                    if (vFuseItem.item.visible === false && role !== "GM") continue;

                    const listItem = document.createElement("li");
                    let trueName = vFuseItem.item.name.toUpperCase().includes(term) ? "" : ` (${vFuseItem.item.text?.plainText})`;
                    if (trueName == " ()") trueName = "";

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
                            await OBR.scene.items.addItems([vFuseItem.item]);
                            storedItems = storedItems.filter(x => x.id !== vFuseItem.item.id);
                            vanishButton.src = "/eyeopen.svg";
                            vanishButton.value = "on";

                            try
                            {
                                const json = JSON.stringify(storedItems);
                                localStorage.setItem(Constants.SCRYKEY, json);
                            }
                            catch (error)
                            {
                                console.log("Cannot save Vanished Items to localstorage, may lose on refresh");
                            }
                        }
                        else
                        {
                            // Get the item fresh from OBR, or it'll be snapshot from the search
                            const freshItem = await OBR.scene.items.getItems([vFuseItem.item.id]);
                            if (freshItem.length > 0)
                            {
                                storedItems.push(freshItem[0]);
                                //await OBR.player.deselect([vFuseItem.item.id]);
                                await OBR.scene.items.deleteItems([vFuseItem.item.id]);
                                vanishButton.value = "off";
                                vanishButton.src = "/eyeclosed.svg";

                                try
                                {
                                    const json = JSON.stringify(storedItems);
                                    localStorage.setItem(Constants.SCRYKEY, json);
                                }
                                catch (error)
                                {
                                    console.log("Cannot save Vanished Items to localstorage, may lose on refresh");
                                }
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
                        storedItems = storedItems.filter(x => x.id !== vFuseItem.item.id);
                        try
                        {
                            const json = JSON.stringify(storedItems);
                            localStorage.setItem(Constants.SCRYKEY, json);
                        }
                        catch (error)
                        {
                            console.log("Cannot save Vanished Items to localstorage, may lose on refresh");
                        }
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
    const filteredItems = items.filter((item) =>
        item.layer == "ATTACHMENT"
        || item.layer == "CHARACTER"
        || item.layer == "PROP"
        || item.layer == "MOUNT"
        || item.layer == "MAP");

    const customItems = [];
    for (const item of filteredItems)
    {
        let anyItem = item as any;
        if (item.text?.plainText)
        {
            anyItem.customTextName = item.text.plainText;
        }
        customItems.push(anyItem);
    }

    sceneItems = customItems;
}