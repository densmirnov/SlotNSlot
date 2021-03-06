import React from 'react';
import { withRouter, Link } from 'react-router-dom';
import { connect } from 'react-redux';
import { getAllSlotMachines, handleClickSortingOption, handleSortDropdownOpen } from './actions';
import Spinner from '../common/spinner';
import SortingHeader from './sortingHeader';
import ListHeader from './listHeader';
import SlotList from './slotList';
import styles from './slotList.scss';

function mapStateToProps(appState) {
  return {
    rootState: appState.root,
    slotListState: appState.slotList,
  };
}

class SlotListContainer extends React.PureComponent {
  constructor(props) {
    super(props);

    this.handleToggleDropdown = this.handleToggleDropdown.bind(this);
    this.handleClickSortingOption = this.handleClickSortingOption.bind(this);
    this.slotListLoaded = false;
  }

  componentDidMount() {
    this.getSlotMachines();
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.rootState.get('account') !== this.props.rootState.get('account') ||
      prevProps.slotListState.get('justLeavedSlotAddress') !== this.props.slotListState.get('justLeavedSlotAddress')
    ) {
      this.getSlotMachines();
    }
  }

  getSlotMachines() {
    const { dispatch, rootState, slotListState } = this.props;
    if (rootState.get('account') && !this.slotListLoaded) {
      dispatch(getAllSlotMachines(rootState.get('account'), slotListState.get('justLeavedSlotAddress')));
      if (slotListState.get('justLeavedSlotAddress') !== null) {
        this.slotListLoaded = true;
      }
    }
  }

  handleToggleDropdown() {
    const { dispatch } = this.props;

    dispatch(handleSortDropdownOpen());
  }

  handleClickSortingOption(option) {
    const { dispatch } = this.props;

    dispatch(handleClickSortingOption(option));
  }

  render() {
    const { slotListState } = this.props;

    let content = null;
    if (slotListState.get('isLoading')) {
      content = (
        <div className={styles.spinnerContainer}>
          <Spinner />
        </div>
      );
    } else if (slotListState.get('hasError')) {
      content = <div>Sorry. We had an error to get the slot machines.</div>;
    } else if (!slotListState.get('allSlotContracts') || !slotListState.get('allSlotContracts').size === 0) {
      content = <div>There are no slot machines yet.</div>;
    } else {
      content = <SlotList slotContracts={slotListState.get('allSlotContracts')} />;
    }

    return (
      <div className={styles.slotListContainer}>
        <ListHeader />
        <div>
          <SortingHeader
            headerTitle="All Slots"
            handleClickSortingOption={this.handleClickSortingOption}
            currentSortingOption={slotListState.get('sortOption')}
            isOpen={slotListState.get('isSortDropdownOpen')}
            handleToggle={this.handleToggleDropdown}
          />
          <div className="container">
            <Link to="/instruction" className={`btn btn-info btn-lg btn-block ${styles.instructionButton}`}>
              HOW TO PLAY
            </Link>
          </div>
          {content}
        </div>
      </div>
    );
  }
}

export default withRouter(connect(mapStateToProps)(SlotListContainer));
