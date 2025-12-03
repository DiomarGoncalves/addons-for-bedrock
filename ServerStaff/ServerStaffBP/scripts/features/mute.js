import { world } from "@minecraft/server";
import { Config } from "../config";

if (world.beforeEvents && world.beforeEvents.chatSend) {
    world.beforeEvents.chatSend.subscribe((event) => {
        const player = event.sender;
        
        // 1. Check Global Mute
        // Verificamos se uma entidade "dummy" ou o próprio mundo tem a tag, 
        // mas como não dá para por tag no mundo facilmente sem setup complexo, 
        // vamos verificar se ALGUM player tem a tag de controle ou usar DynamicProperties.
        // Simplificação: Vamos checar se o mundo tem a property (setup mais avançado)
        // OU: Checar se o sender não é staff e o global mute está on.
        
        // Vamos usar Dynamic Property no Mundo para Global Mute e Manutenção
        const isGlobalMute = world.getDynamicProperty(Config.GLOBAL_MUTE_TAG);

        if (isGlobalMute && !player.hasTag(Config.STAFF_TAG)) {
            event.cancel = true;
            player.sendMessage(Config.PREFIX + "O Chat Global esta desativado.");
            return;
        }

        // 2. Check Individual Mute
        if (player.hasTag(Config.MUTE_TAG)) {
            event.cancel = true;
            player.sendMessage(Config.PREFIX + "Voce esta mutado.");
        }
    });
}