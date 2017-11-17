import React from "react";
import PropTypes from "prop-types";

import {strToColor} from "../utils.js";

const GitUser = (props) => 
			<div className="avatar">
				{
				props.avatar ?
				 <img alt="" 
					style={!props.avatar ? {backgroundColor: "#"+strToColor(props.name, 250)} : null} 
					src={props.avatar || null}/> :
				<div className="avatar" style={{backgroundColor: "#"+strToColor(props.name, 250)}}/>
				}
				<span>{props.name}</span>
			</div>;

GitUser.propTypes = {
	name: PropTypes.string.isRequired,
	avatar: PropTypes.string
};

export {GitUser};
