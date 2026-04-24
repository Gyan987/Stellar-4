/// <reference types="vite/client" />

interface FreighterApi {
	getPublicKey: () => Promise<string>;
}

interface Window {
	freighterApi?: FreighterApi;
}
