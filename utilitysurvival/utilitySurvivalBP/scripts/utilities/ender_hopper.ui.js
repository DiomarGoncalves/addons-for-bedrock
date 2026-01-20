import { ModalFormData } from "@minecraft/server-ui";
import { ENDER_HOPPER_MAX_RANGE } from "../config/constants";

export function openEnderHopperUI(player, currentConfig, onSave) {
  const form = new ModalFormData()
    .title("Ender Hopper")
    .toggle("Ativar puxar itens", !!currentConfig.enabled)
    .slider("Alcance (blocos)", 0, ENDER_HOPPER_MAX_RANGE, 1, Math.max(0, Math.min(ENDER_HOPPER_MAX_RANGE, currentConfig.range ?? 0)));

  form.show(player).then((res) => {
    if (res.canceled) return;
    const [enabled, range] = res.formValues;
    onSave({ enabled: !!enabled, range: Math.floor(range) });
  });
}
