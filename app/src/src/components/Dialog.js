import React from 'react';
import PropTypes from 'prop-types';

import './Dialog.css';

const withDialog = (Component) => {
	let e = ({show, hide, style, ...props}) => 
					show ? 
						<Dialog show={show} hide={hide} style={style}>
							<Component hide={hide} { ...props } />
						</Dialog> : null;
	e.displayName = `withDialog(${Component.displayName || Component.name})`;
	return e;
};

/*
<Dialog show={this.state.something} hide={()=>this.setState({something: false}) - remove to disable auto hide}
		style={{style for .dialog..}}>
	<div> Some Content </div>
</Dialog>
*/
class Dialog extends React.Component {
	constructor(props){
		super(props);

		if(this.props.hide){
			this.clickListener = evt =>{
				if(evt.target === this.node && this.props.show){
					this.props.hide();
					document.body.classList.remove('noscroll');
				}
			};
			this.keydownListener = evt =>{
				if(evt.key == 'Escape' && this.props.show){
					this.props.hide();
					document.body.classList.remove('noscroll');
				}
			};
		}
	}

	componentDidMount(){
		if(this.props.hide){
			document.addEventListener('click', this.clickListener);
			document.addEventListener('keydown', this.keydownListener);
		}
		if(this.props.show){
			document.body.classList.add('noscroll');
		}
	}

	componentWillUnmount(){
		if(this.props.hide){
			document.removeEventListener('click', this.clickListener);
			document.removeEventListener('keydown', this.keydownListener);
		}
		document.body.classList.remove('noscroll');
	}

	componentDidUpdate(){
		if(this.props.show){
			document.body.classList.add('noscroll');
		} else {
			document.body.classList.remove('noscroll');
		}
	}

	render(){
		return this.props.show && (
		<div className='dialog' ref={(n)=>{this.node = n;}}>
			<div style={this.props.style}>
				<div className='content'>
					{this.props.children}
				</div>
			</div>
		</div>);
	}
}

Dialog.propTypes = {
	show: PropTypes.bool.isRequired,
	hide: PropTypes.func,
	style: PropTypes.object
};



export default Dialog;
export {withDialog};