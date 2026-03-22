const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
	entry: {
		'scripts/main': './src/scripts/main.ts',
		'scripts/injection': './src/scripts/injection.ts',
		'scripts/communicator': './src/scripts/communicator.ts',
		'scripts/panel': './src/scripts/panel.ts',
	},
	output: {
		filename: '[name].js',
		path: path.resolve(__dirname, 'dist'),
		clean: true,
	},
	devtool: 'source-map',
	resolve: {
		extensions: ['.ts', '.js'],
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: {
					loader: 'ts-loader',
				},
			},
		],
	},
	plugins: [
		new CopyWebpackPlugin({
			patterns: [
				{ from: 'src/manifest.json', to: '' },
				{ from: 'src/main.html', to: '' },
				{ from: 'src/panel.html', to: '' },
				{ from: 'src/icons', to: 'icons' },
			],
		}),
	],
	mode: 'development',
};
