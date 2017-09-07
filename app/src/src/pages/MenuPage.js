import React from 'react';
import Navigation from '../components/Navigation.js';

const MenuPage = (props) => (
	// console.log('menu') || 
	<div>
		<Navigation pages={props.pages}/>
		<div id="main">
			{props.children}
		</div>
	</div>
);



export default MenuPage;