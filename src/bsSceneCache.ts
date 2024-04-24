import OBR, { Grid, Item, Metadata, Player, Theme } from "@owlbear-rodeo/sdk";
import * as Utilities from './bsUtilities';
import { Constants } from "./constants";
import { SetupForm } from "./main";

class BSCache
{
    // Cache Names
    static PLAYER = "PLAYER";
    static PARTY = "PARTY";
    static SCENEITEMS = "SCENEITEMS";
    static SCENEMETA = "SCENEMETADATA";
    static SCENEGRID = "SCENEGRID";
    static ROOMMETA = "ROOMMETADATA";

    CHARACTER_CACHE: any[];
    USER_REGISTERED: boolean;
    LOADING: boolean;
    playerId: string;
    playerColor: string;
    playerName: string;
    playerMetadata: {};
    playerRole: "GM" | "PLAYER";

    locked: boolean;
    party: Player[];
    lastParty: Player[];

    gridDpi: number;
    gridScale: number; // IE; 5ft

    storedMetaItems: Item[];
    sceneItems: Item[];
    sceneSelected: string[];
    sceneMetadata: Metadata;
    sceneReady: boolean;

    oldRoomMetadata: Metadata;
    roomMetadata: Metadata;

    theme: any;

    caches: string[];

    //handlers
    sceneMetadataHandler?: () => void;
    sceneItemsHandler?: () => void;
    sceneGridHandler?: () => void;
    sceneReadyHandler?: () => void;
    playerHandler?: () => void;
    partyHandler?: () => void;
    themeHandler?: () => void;
    roomHandler?: () => void;

    constructor(caches: string[])
    {
        this.playerId = "";
        this.playerName = "";
        this.playerColor = "";
        this.playerMetadata = {};
        this.playerRole = "PLAYER";
        this.party = [];
        this.lastParty = [];
        this.storedMetaItems = [];
        this.sceneItems = [];
        this.sceneSelected = [];
        this.sceneMetadata = {};
        this.gridDpi = 0;
        this.gridScale = 5;
        this.sceneReady = false;
        this.theme = "DARK";
        this.oldRoomMetadata = {};
        this.roomMetadata = {};
        this.locked = false;

        this.LOADING = false;
        this.CHARACTER_CACHE = [];
        this.USER_REGISTERED = false;
        this.caches = caches;
    }

    public async InitializeCache()
    {
        // Always Cache
        this.sceneReady = await OBR.scene.isReady();
        this.theme = await OBR.theme.getTheme();

        Utilities.SetThemeMode(this.theme, document);

        if (this.caches.includes(BSCache.PLAYER))
        {
            this.playerId = await OBR.player.getId();
            this.playerName = await OBR.player.getName();
            this.playerColor = await OBR.player.getColor();
            this.playerMetadata = await OBR.player.getMetadata();
            this.playerRole = await OBR.player.getRole();
        }

        if (this.caches.includes(BSCache.PARTY))
        {
            this.party = await OBR.party.getPlayers();
        }

        if (this.caches.includes(BSCache.SCENEITEMS))
        {
            if (this.sceneReady)
            {
                const items = await OBR.scene.items.getItems();

                const customItems = [];
                for (const item of items)
                {
                    let anyItem = item as any;
                    anyItem.secretIdentity = item.id;
                    if (anyItem.text?.plainText)
                    {
                        anyItem.customTextName = anyItem.text.plainText;
                    }
                    customItems.push(anyItem);
                }
                this.sceneItems = customItems;
            }
        }

        if (this.caches.includes(BSCache.SCENEMETA))
        {
            if (this.sceneReady)
            {
                this.sceneMetadata = await OBR.scene.getMetadata();
                const savedItems = this.sceneMetadata[`${Constants.EXTENSIONID}/stored`];
                if (savedItems)
                {
                    this.storedMetaItems = savedItems as Item[];
                }
            }
        }

        if (this.caches.includes(BSCache.SCENEGRID))
        {
            if (this.sceneReady)
            {
                this.gridDpi = await OBR.scene.grid.getDpi();
                this.gridScale = (await OBR.scene.grid.getScale()).parsed?.multiplier ?? 5;
            }
        }

        if (this.caches.includes(BSCache.ROOMMETA))
        {
            if (this.sceneReady) this.roomMetadata = await OBR.room.getMetadata();
        }

        //await this.CheckRegistration();
    }

    public KillHandlers()
    {
        if (this.caches.includes(BSCache.SCENEMETA) && this.sceneMetadataHandler !== undefined) this.sceneMetadataHandler!();
        if (this.caches.includes(BSCache.SCENEITEMS) && this.sceneItemsHandler !== undefined) this.sceneItemsHandler!();
        if (this.caches.includes(BSCache.SCENEGRID) && this.sceneGridHandler !== undefined) this.sceneGridHandler!();
        if (this.caches.includes(BSCache.PLAYER) && this.playerHandler !== undefined) this.playerHandler!();
        if (this.caches.includes(BSCache.PARTY) && this.partyHandler !== undefined) this.partyHandler!();
        if (this.caches.includes(BSCache.ROOMMETA) && this.roomHandler !== undefined) this.roomHandler!();

        if (this.themeHandler !== undefined) this.themeHandler!();
    }

    public SetupHandlers()
    {
        if (this.sceneMetadataHandler === undefined || this.sceneMetadataHandler.length === 0)
        {
            if (this.caches.includes(BSCache.SCENEMETA))
            {
                this.sceneMetadataHandler = OBR.scene.onMetadataChange(async (metadata) =>
                {
                    const appWindow = document.querySelector<HTMLDivElement>('#app')!
                    const lockWindow = document.querySelector<HTMLDivElement>('#locked')!

                    this.storedMetaItems = metadata[`${Constants.EXTENSIONID}/stored`] as [];
                    if (!this.storedMetaItems) this.storedMetaItems = [];

                    const checkLock = metadata[`${Constants.EXTENSIONID}/locked`] as boolean;
                    this.locked = checkLock ? true : false;
                    if (BSCACHE.playerRole === "PLAYER")
                    {
                        if (this.locked)
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
                    this.sceneMetadata = metadata;
                });
            }
        }

        if (this.sceneItemsHandler === undefined || this.sceneItemsHandler.length === 0)
        {
            if (this.caches.includes(BSCache.SCENEITEMS))
            {
                this.sceneItemsHandler = OBR.scene.items.onChange(async (items) =>
                {
                    const customItems = [];
                    for (const item of items)
                    {
                        let anyItem = item as any;
                        anyItem.secretIdentity = item.id;
                        if (anyItem.text?.plainText)
                        {
                            anyItem.customTextName = anyItem.text.plainText;
                        }
                        customItems.push(anyItem);
                    }
                    this.sceneItems = customItems;
                });
            }
        }

        if (this.sceneGridHandler === undefined || this.sceneGridHandler.length === 0)
        {
            if (this.caches.includes(BSCache.SCENEGRID))
            {
                this.sceneGridHandler = OBR.scene.grid.onChange(async (grid) =>
                {
                    this.gridDpi = grid.dpi;
                    this.gridScale = parseInt(grid.scale);
                    await this.OnSceneGridChange(grid);
                });
            }
        }

        if (this.playerHandler === undefined || this.playerHandler.length === 0)
        {
            if (this.caches.includes(BSCache.PLAYER))
            {
                this.playerHandler = OBR.player.onChange(async (player) =>
                {
                    this.playerName = player.name;
                    this.playerColor = player.color;
                    this.playerId = player.id;
                    this.playerRole = player.role;
                    this.playerMetadata = player.metadata;
                    await this.OnPlayerChange(player);
                });
            }
        }

        if (this.partyHandler === undefined || this.partyHandler.length === 0)
        {
            if (this.caches.includes(BSCache.PARTY))
            {
                this.partyHandler = OBR.party.onChange(async (party) =>
                {
                    this.party = party.filter(x => x.id !== "");
                    await this.OnPartyChange(party);
                });
            }
        }

        if (this.roomHandler === undefined || this.roomHandler.length === 0)
        {
            if (this.caches.includes(BSCache.ROOMMETA))
            {
                this.roomHandler = OBR.room.onMetadataChange(async (metadata) =>
                {
                    this.roomMetadata = metadata;
                    await this.OnRoomMetadataChange(metadata);
                    this.oldRoomMetadata = metadata;
                });
            }
        }


        if (this.themeHandler === undefined)
        {
            this.themeHandler = OBR.theme.onChange(async (theme) =>
            {
                this.theme = theme.mode;
                await this.OnThemeChange(theme);
            });
        }

        // Only setup if we don't have one, never kill
        if (this.sceneReadyHandler === undefined)
        {
            this.sceneReadyHandler = OBR.scene.onReadyChange(async (ready) =>
            {
                this.sceneReady = ready;

                if (ready)
                {
                    this.sceneItems = await OBR.scene.items.getItems();
                    this.sceneMetadata = await OBR.scene.getMetadata();
                    this.gridDpi = await OBR.scene.grid.getDpi();
                    this.gridScale = (await OBR.scene.grid.getScale()).parsed?.multiplier ?? 5;
                }
                await this.OnSceneReadyChange(ready);
            });
        }
    }

    public async OnSceneMetadataChanges(_metadata: Metadata)
    {
    }


    public async OnSceneItemsChange(_items: Item[])
    {

    }

    public async OnSceneGridChange(_grid: Grid)
    {

    }

    public async OnSceneReadyChange(ready: boolean)
    {
        if (ready)
        {
            await SetupForm();
        }
        else
        {
            document.querySelector<HTMLDivElement>('#app')!.innerHTML = `<div id="startup">Awaiting Scene..</div>`;
        }
    }

    public async OnPlayerChange(_player: Player)
    {
    }

    public async OnPartyChange(_party: Player[])
    {
    }

    public async OnRoomMetadataChange(_metadata: Metadata)
    {
    }

    public async OnThemeChange(theme: Theme)
    {
        Utilities.SetThemeMode(theme, document);
    }

    public async CheckRegistration()
    {
        try
        {
            const debug = window.location.origin.includes("localhost") ? "eternaldream" : "";
            const userid = {
                owlbearid: BSCACHE.playerId
            };

            const requestOptions = {
                method: "POST",
                headers: new Headers({
                    "Content-Type": "application/json",
                    "Authorization": Constants.ANONAUTH,
                    "x-manuel": debug
                }),
                body: JSON.stringify(userid),
            };
            const response = await fetch(Constants.CHECKREGISTRATION, requestOptions);

            if (!response.ok)
            {
                const errorData = await response.json();
                // Handle error data
                console.error("Error:", errorData);
                return;
            }
            const data = await response.json();
            if (data.Data === "OK")
            {
                this.USER_REGISTERED = true;
                console.log("Connected");
            }
            else console.log("Not Registered");
        }
        catch (error)
        {
            // Handle errors
            console.error("Error:", error);
        }
    }
};

// Set the handlers needed for this Extension
export const BSCACHE = new BSCache([BSCache.SCENEITEMS, BSCache.SCENEMETA, BSCache.PLAYER]);
