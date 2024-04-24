import OBR from "@owlbear-rodeo/sdk";
import { Constants } from "./constants";
import '/src/w-style.css'

const whatsnew = document.querySelector<HTMLDivElement>('#bs-whatsnew')!;
const footer = document.querySelector<HTMLElement>('#bs-whatsnew-notes')!;

whatsnew.innerHTML = `
  <div id="newsContainer">
    <h1>Scry! 4/24</h1>
    Slight hiccup. Forgot to add the loader for stored 'Vanisihed' items. Fixed.
    </br>
    <h1>Scry! 4/23</h1>
    Slight revamp. Bringing things more in line with the other extensions.
    </br> Next steps will be adding more documentation to this part (As well as the OBR store..) but as you can guess, I have a lot of writing to do.
    </br> Changes!
    </br> The update before this cleared out the busy layers to avoid your searches being cluttered. It left it unable to find certain items though unless you did an 'ALL' search.
    </br> Specific layer searches were adding, just prefix with "<layer>:".
    </br> For example, "FOG:DungeonLine" or "CHARACTER:DEVIL". Or just "PROP:" if you want to see all of them.
    </br> This works for MAP, PROP, MOUNT, CHARACTER, ATTACHMENT, NOTE, FOG and TEXT.
    Enjoy!
    </br>
    </br>
  </div>
`;

OBR.onReady(async () =>
    {
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        const subscriberId = urlParams.get('subscriber')!;
        const subscriber = subscriberId === "true";
    
        footer.innerHTML = `
        <div id="footButtonContainer">
            <button id="discordButton" type="button" title="Join the Owlbear-Rodeo Discord"><embed class="svg discord" src="/w-discord.svg" /></button>
            <button id="patreonButton" type="button" ${subscriber ? 'title="Thank you for subscribing!"': 'title="Check out the Battle-System Patreon"'}>
            ${subscriber ? '<embed id="patreonLogo" class="svg thankyou" src="/thankyou.svg" />'
                : '<embed id="patreonLogo" class="svg patreon" src="/w-patreon.png" />'}</button>
        </div>
        <button id="closeButton" type="button" title="Close this window"><embed class="svg close" src="/w-close.svg" /></button>
        `;
    
        const closebutton = document.getElementById('closeButton');
        closebutton!.onclick = async () =>
        {
            await OBR.modal.close(Constants.EXTENSIONWHATSNEW);
        };
    
        const discordButton = document.getElementById('discordButton');
        discordButton!.onclick = async (e) =>
        {
            e.preventDefault();
            window.open("https://discord.gg/ANZKDmWzr6", "_blank");
        };
    
        const patreonButton = document.getElementById('patreonButton');
        patreonButton!.onclick = async (e) =>
        {
            e.preventDefault();
            window.open("https://www.patreon.com/battlesystem", "_blank");
        };
    });
    
