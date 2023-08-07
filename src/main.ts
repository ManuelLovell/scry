import OBR, { Image, Item } from '@owlbear-rodeo/sdk'
import { IStoredItem } from './interfaces';
import { ViewportFunctions } from './viewport';
import * as Utilities from "./utilities";
import Fuse from 'fuse.js';
import './style.css'

let sceneItems: IStoredItem[] = [];
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

    OBR.scene.items.onChange((items) =>
    {
        FilterItems(items);
    });
});

async function SetupForm(): Promise<void>
{
    await FilterItems(await OBR.scene.items.getItems());
    document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
        <div id="counter" class="count"></div>
        <div class="wrapper">
            <input type="text" id="searchBar" onkeyup="StartSearch()" placeholder="Search for..">
            <button id="clearSearch" class="clear">X</button>
        </div>
        <div class="scrollable">
            <ol id="searchList"></ol>
        </div>
    `;

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
        const term = searchInput.value.toUpperCase();
        if (!term || term.length < 2)
        {
            countElement.innerText = "...";
            return searchList.innerHTML = "";
        }

        searchList.innerHTML = "";
        countElement.innerText = "...";
        let increment = 1;

        const fuse = new Fuse(sceneItems, { threshold: 0.4, includeScore: true, keys: ['name', 'textName'] });
        const foundItems = fuse.search(term);


        if (foundItems.length > 0)
        {
            const visibleCount = role === "GM" ? foundItems.length.toString() : foundItems.filter(item => item.item.visible === true).length.toString();
            countElement.innerText = visibleCount;

            for (const fuseItem of foundItems)
            {
                if (fuseItem.item.visible === false && role !== "GM") continue;

                const listItem = document.createElement("li");
                let trueName = fuseItem.item.name.toUpperCase().includes(term) ? "" : ` (${fuseItem.item.textName})`;
                if (trueName == " ()") trueName = "";

                listItem.id = "li-" + fuseItem.item.id;
                listItem.textContent = `${increment}.   ${fuseItem.item.name}${trueName}${fuseItem.item.visible ? "" : " (Hidden)"}`;
                listItem.onclick = async () =>
                {
                    ViewportFunctions.CenterViewportOnImage(fuseItem.item);
                    await OBR.player.select([fuseItem.item.id]);
                };
                searchList.appendChild(listItem);
                increment++;
            }
        }
    }
}

async function FilterItems(items: Item[])
{
    const filteredItems = items.filter((item) =>
        item.layer == "ATTACHMENT"
        || item.layer == "CHARACTER"
        || item.layer == "PROP"
        || item.layer == "MOUNT"
        || item.layer == "MAP");

    const imageItems = filteredItems as Image[];
    sceneItems = imageItems.map((image: Image) => ({
        id: image.id!,
        name: image.name,
        textName: image.text.plainText,
        visible: image.visible,
        xpos: image.position.x,
        ypos: image.position.y,
        dpi: image.grid.dpi,
        width: image.image.width,
        height: image.image.height,
        offsetx: image.grid.offset.x,
        offsety: image.grid.offset.y
    }));
}