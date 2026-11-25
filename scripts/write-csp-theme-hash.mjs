import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ThemeProvider} from 'next-themes';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const html=renderToStaticMarkup(React.createElement(ThemeProvider,{attribute:'data-theme',defaultTheme:'dark',enableSystem:false,storageKey:'moyo-theme',disableTransitionOnChange:true},null));
const script=html.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1];if(!script)throw Error('Could not identify the fixed theme bootstrap script.');
writeFileSync('lib/theme-script-hash.json',JSON.stringify({sha256:createHash('sha256').update(script).digest('base64'),productionSha256:'wjfYtL00ZEr7Ze+gL4t7kjIK3053RGM8sZtXNrKAEHA='})+'\n');
