import OBR, { Image, Item } from '@owlbear-rodeo/sdk'
import { IStoredItem } from './interfaces';
import './style.css'
import { ViewportFunctions } from './viewport';

let sceneItems: IStoredItem[] = [];
let role: string;

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `<div id="startup">Awaiting scene...</div>`;

OBR.onReady(async () =>
{
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
            document.querySelector<HTMLDivElement>('#app')!.innerHTML = `<div id="startup">Awaiting scene...</div>`;
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
        <div class="wrapper">
            <input type="text" id="searchBar" onkeyup="StartSearch()" placeholder="Search for..">
            <button id="clearSearch" class="clear">X</button>
        </div>
        <div class="scrollable">
            <ul id="searchList"></ul>
        </div>
    `;

    const searchList = document.getElementById("searchList") as HTMLUListElement;
    const searchInput = document.getElementById("searchBar") as HTMLInputElement;
    const clearButton = document.getElementById("clearSearch") as HTMLButtonElement;

    clearButton.onclick = () =>
    {
        searchInput.value = "";
        searchList.innerHTML = "";
    };

    searchInput.onkeyup = () =>
    {
        const term = searchInput.value.toUpperCase();
        if (!term || term.length < 2) return searchList.innerHTML = "";

        searchList.innerHTML = "";

        for (const item of sceneItems)
        {
            const itemName = item.name.toUpperCase();
            if (itemName.includes(term))
            {
                if (item.visible === false && role !== "GM") continue;

                const listItem = document.createElement("li");
                listItem.id = "li-" + item.id;
                listItem.textContent = `${item.name}${item.visible ? "" : " (Hidden)"}`;
                listItem.onclick = () =>
                {
                    ViewportFunctions.CenterViewportOnImage(item);
                };
                searchList.appendChild(listItem);
            }
        }
    };
}

async function FilterItems(items: Item[])
{
    const filteredItems = items.filter((item) =>
        item.layer == "ATTACHMENT"
        || item.layer == "CHARACTER"
        || item.layer == "PROP"
        || item.layer == "MOUNT"
        || item.layer == "MAP"
        || item.layer == "DRAWING");

    const imageItems = filteredItems as Image[];
    sceneItems = imageItems.map((image: Image) => ({
        id: image.id!,
        name: image.name,
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