import {Config} from '@remotion/cli/config';
if(process.env.CHROME_PATH)Config.setBrowserExecutable(process.env.CHROME_PATH);else if(process.platform==='win32')Config.setBrowserExecutable('C:/Program Files/Google/Chrome/Application/chrome.exe');
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle');
Config.setConcurrency(2);
