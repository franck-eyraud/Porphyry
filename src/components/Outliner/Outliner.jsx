import React from 'react';
import { Link } from 'react-router-dom';
import Hypertopic from 'hypertopic';
import conf from '../../config/config.json';
import Header from '../Header/Header.jsx';
import Authenticated from '../Authenticated/Authenticated.jsx';
import TopicTree from './TopicTree.js';
import { DragDropContextProvider, DragSource } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';

import '../../styles/App.css';

const db = new Hypertopic(conf.services);

const _log = (x) => console.log(JSON.stringify(x, null, 2));
const _error = (x) => console.error(x.message);

class Outliner extends React.Component {

  constructor() {
    super();
    this.state = { };
    this.changing=false;
    this.user = conf.user || window.location.hostname.split('.', 1)[0];
  }

  render() {
    let status = this._getStatus();
    return (
      <DragDropContextProvider backend={HTML5Backend}>
      <div className="App container-fluid">
        <Header />
        <div className="Status row h5">
          <Authenticated/>
          <Link to="/" className="badge badge-pill badge-light TopicTag">
            <span className="badge badge-pill badge-dark oi oi-chevron-left"> </span> Retour à l'accueil
          </Link>
        </div>
        <div className="container-fluid">
          <div className="App-content row">
            <div className="col-md-12 p-4">
              <div className="Description">
                <h2 className="h4 font-weight-bold text-center">{status}</h2>
                <div className="p-3">
                  {this.state.title ? '' : this._getTitle()}
                  <ul className="Outliner">
                    <Node topics={this.state.topics} name={this.state.title} activeNode={this.state.activeNode}
                      change={this.editTopic.bind(this)} activate={this.activeNode.bind(this)} id="root"/>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </DragDropContextProvider>
    );
  }

  _getTitle() {
    return (<form className="input-group" onSubmit={(e) => this._newVP(e)}>
      <input type="text" name="newTitle" className="form-control" placeholder="Nom du point de vue" />
      <div className="input-group-append">
        <button type="submit" className="btn add btn-sm btn-light"><span className="oi oi-plus"> </span></button>
      </div>
    </form>);
  }

  _getStatus() {
    if (this.state.title !== undefined) {
      return "Modification du point de vue";
    } else {
      return "Création du point de vue";
    }
  }

  _newVP(e) {
    e.preventDefault();
    let title = e.target.newTitle.value;
    if (!title) {
      return;
    }
    db.post({ _id: this.props.match.params.id, viewpoint_name: title, topics: {}, users: [this.user] })
      .then(_log)
      .then(_ => this.setState({ title }))
      .then(_ => this._fetchData())
      .catch(_error);
  }

  activeNode(id) {
    this.setState({activeNode:id});
  }

  handleKeyAction(e) {
    var changed=false;
    switch (e.key) {
      case "Enter":
        var topic=this.topicTree.newSibling(this.state.activeNode);
        this.activeNode(topic.id);
        changed=true;
        break;
      case "Tab":
        if (!e.altKey && !e.ctrlKey) {
          if (e.shiftKey) {
            changed=this.topicTree.promote(this.state.activeNode);
          } else {
            changed=this.topicTree.demote(this.state.activeNode);
          }
        }
        break;
      case 'ArrowUp':
        if (!e.altKey && !e.ctrlKey && !e.shiftKey) {
          this.activeNode(this.topicTree.getPreviousTopic(this.state.activeNode));
        }
        if (e.ctrlKey && !e.altKey && !e.shiftKey) {
          changed=this.topicTree.moveUp(this.state.activeNode);
        }
        break;
      case 'ArrowDown':
        if (!e.altKey && !e.ctrlKey && !e.shiftKey) {
          this.activeNode(this.topicTree.getNextTopic(this.state.activeNode));
        }
        if (e.ctrlKey && !e.altKey && !e.shiftKey) {
          changed=this.topicTree.moveDown(this.state.activeNode);
        }
        break;
      case 'Delete':
      case 'Backspace':
        if (!e.altKey && !e.ctrlKey && !e.shiftKey) {
          if (e.target.tagName==="BODY" || e.target.value==='' ) {
            let previousTopic=this.topicTree.getPreviousTopic(this.state.activeNode);
            changed=this.topicTree.deleteTopic(this.state.activeNode);
            if (changed) this.activeNode(this.topicTree.getNextTopic(previousTopic));
          }
        }
        break;
      default:
    }
    if (changed) {
      e.preventDefault();
      this.setState({topics:this.topicTree.topics},this.applyChange.bind(this));
    }
    return;
  };

  editTopic(id,change) {
    if (!this.setState) {
      console.log("no setState ?");
      return;
    }
    return this.setState(previousState => {
      let topics=previousState.topics;
      let topic;
      if (!id) {
        if (change.name && change.name!==previousState.title) {
          return {title:change.name}
        }
      } else if (topics[id]) {
        if (change.delete) {
          delete topics[id];
        } else {
          topic=topics[id];
        }
      }
      if (topic) {
        for (let key in change) {
          topic[key]=change[key];
        }
      }
      return {topics};
    },this.applyChange.bind(this));
  }

  componentDidMount() {
    this._fetchData();
    this._timer = setInterval(this._fetchData.bind(this),5000);
    //document.addEventListener("keypress", this.handleKeyAction.bind(this));
    document.addEventListener("keydown", this.handleKeyAction.bind(this));
  }

  componentWillUnmount() {
    clearInterval(this._timer);
  }

  applyChange() {
    if (!this.changing) {
      this.changing=db.get({ _id: this.props.match.params.id })
        .then(data => {
          data.topics = this.state.topics;
          data.viewpoint_name = this.state.title;
          return data;
        })
        .then(db.post)
        .catch(_ => {
          _error(_);
        }).finally(() => {
          this.changing=false;
          this._fetchData();
        });
    }
    return this.changing;
  }

  _fetchData() {
    if (!this.changing) {
    return db.get({ _id: this.props.match.params.id })
      .then(x => {
        this.setState({ topics: x.topics, title: x.viewpoint_name });
        this.topicTree=new TopicTree(x.topics);
      });
    } else {
      return true;
    }
  }

}

const ItemTypes = {
  NODE: 'node'
}

const nodeSource = {
  beginDrag(props) {
    console.log("begin drag");
    return {};
  },
  canDrag(props) {
    console.log("can drag");
    return true;
  }
};


function collect(connect, monitor) {
  console.log("collect");
  return {
    connectDragSource: connect.dragSource(),
    isDragging: monitor.isDragging()
  }
}


class Node extends React.Component {

  constructor() {
    super();
    this.state = { edit: false, active: false, open: true };
    this.user = conf.user || window.location.hostname.split('.', 1)[0];
  }

  render = () => {
    let switchOpen = () => {
      this.setState({open:!this.state.open});
    }
    let switchEdit = (e) => {
      e.stopPropagation();
      this.setState({edit:!this.state.edit});
    }
    let change=this.props.change;
    let commitEdit = (e) => {
      let newName=e.target.value;
      if (newName!==this.props.name) {
        change(this.props.id,{name:newName});
      }
      switchEdit(e);
    }
    let handleInput = (e) => {
      switch(e.key) {
        case "Enter":
          commitEdit(e);
          e.stopPropagation();
          break;
        case "Escape":
          e.target.value=this.props.name;
          e.stopPropagation();
          break;
        default:
      }
    };
    let activeMe = (e) => {
      e.stopPropagation();
      this.props.activate(this.props.id);
    }
    let thisNode;
    if (this.state.edit || !this.props.name) {
      thisNode=<input autoFocus type='text' defaultValue={this.props.name} onKeyPress={handleInput} onKeyDown={handleInput} onBlur={commitEdit}/>;
    } else {
      thisNode=<span className="node" onDoubleClick={switchEdit}>{this.props.name}</span>;
    }
    let children=[];
    if (this.props.topics) {
      for (var topID in this.props.topics) {
        let topic=this.props.topics[topID];
        if ((this.props.id && topic.broader.indexOf(this.props.id)!==-1)
          || (this.props.id==="root" && topic.broader.length===0)) {
            children.push(
              <DragNode key={topID} id={topID} name={topic.name} topics={this.props.topics} activeNode={this.props.activeNode} parent={this.props.id}
                activate={this.props.activate} change={this.props.change}/>
            );
        }
      }
    }
    var classes=["outliner-node"];
    if (this.props.activeNode===this.props.id) {
      classes.push("active");
    }
    let caret;
    if (this.props.id && children.length) {
      caret=<span className="caret" onClick={switchOpen}> </span>;
      if (this.state.open) classes.push("open");
      else classes.push("closed");
    } else {
      caret=null;
    }
    const { isDragging, connectDragSource } = this.props;
    console.log("isDragging:"+isDragging);
    return (
      <li className={classes.join(" ")}>
        {caret}<span className="wrap" onClick={activeMe}>{thisNode}<span className="id">{this.props.id}</span></span>
        <ul>{children}</ul>
      </li>);
  };

}
const DragNode=DragSource(ItemTypes.NODE, nodeSource, collect)(Node);

export default Outliner;
