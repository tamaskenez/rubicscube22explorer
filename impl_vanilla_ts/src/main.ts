import { Logic } from './logic';
import { UI } from './ui';

const host = document.getElementById('app')!;

const ui = new UI(host);
const logic = new Logic(ui);
ui.onPaletteColorClicked = (color) => logic.onPaletteColorClicked(color);
ui.onMainCubeFaceletClicked = (face, index) => logic.onMainCubeFaceletClicked(face, index);
ui.onNextStepCubeClicked = (index) => logic.onNextStepCubeClicked(index);

logic.start();
ui.start();
