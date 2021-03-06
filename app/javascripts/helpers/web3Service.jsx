import Web3 from 'web3';
import Store from 'store';
import { logException } from '../helpers/errorLogger';
import updatePlugin from 'store/plugins/update';
import { USER_TYPES } from '../components/slotList/actions';
import Toast from './notieHelper';

const managerABI = require('./managerABI.json');
const storageABI = require('./storageABI.json');
const slotMachineABI = require('./slotMachineABI.json');

const SHA_CHAIN_NUM = 3;
const ROUND_PER_CHAIN = 3333;
const INIT_ROUND = ROUND_PER_CHAIN + 1;
const GAS_PRICE = 21 * 10 ** 9; // 21 GWei
const NULL_PLAYER_ADDRESS = '0x0000000000000000000000000000000000000000';

const SLOT_MANAGER_ADDRESS = '0x04d053f69b504ca6b795c5e4e442222e7f16dcb4';
const SLOT_TOPICS_ENCODED = {
  gameOccupied: '0xa8594317be29e78728fb10fbf57b1f8becff7bc83fa4639b9c3b0a4c965f9629',
  bankerSeedInitialized: '0xa4338f9ae2970a5aa65035a4c9fb88da1cd0940e3df6fd42874bb3d862806972',
  gameInitialized: '0xb7f32217976898f350090cced7da439b6a1de2d176c3895f4cf388c6a9388190',
  bankerSeedSet: '0x05157405ea453181cba290132a142d488a688a03f0b08869ca47c88a0cbba8b5',
  playerSeedSet: '0xee65ec46c8744067af9955308ee9958ab02a5882e505b3b06e3e4e50cada6014',
  gameConfirmed: '0xf77a3f60313a25f9aeff0bdd6f243b0b6f7cae52522d7b99f8c92d7ffcdbf17d',
  playerLeft: '0x471055d6adcbcece6a26aaf208fc1e5e978d9ebd07c0293ea1ac2a00dab7ec98',
};

Store.addPlugin(updatePlugin);

class Web3Service {
  constructor() {
    this.web3 = null;
    this.slotManagerContract = null;
    this.slotStorageContract = null;
    this.storageAddr = null;

    if (typeof web3 !== 'undefined') {
      // Use Mist/MetaMask's provider
      this.web3 = new Web3(window.web3.currentProvider);
      const SlotManagerContract = this.web3.eth.contract(managerABI);
      this.slotManagerContract = SlotManagerContract.at(SLOT_MANAGER_ADDRESS);
    } else {
      // console.warn(
      //   "No web3 detected. Falling back to https://localhost:8545. You should remove this fallback when you deploy live, as it's inherently insecure. Consider switching to Metamask for development. More info here: http://truffleframework.com/tutorials/truffle-and-metamask",
      // );
      // if (EnvChecker.isDev()) {
      this.web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
      const SlotManagerContract = this.web3.eth.contract(managerABI);
      this.slotManagerContract = SlotManagerContract.at(SLOT_MANAGER_ADDRESS);
      // }
    }
  }

  makeS3Sha(recursiveLength, genesisRandomNumber = Math.random().toString()) {
    const originalString = genesisRandomNumber;

    let shaValue;
    for (let i = 0; i < recursiveLength; i += 1) {
      if (shaValue) {
        shaValue = this.web3.sha3(shaValue, { encoding: 'hex' });
      } else {
        shaValue = this.web3.sha3(originalString, { encoding: 'hex' });
      }
    }

    return shaValue;
  }

  async initializeStorageContract() {
    if (this.slotManagerContract) {
      await new Promise((resolve, reject) => {
        this.slotManagerContract.getStorageAddr((err, storageAddr) => {
          if (err) {
            reject(err);
          } else {
            this.storageAddr = storageAddr;
            resolve(storageAddr);
          }
        });
      });
      const SlotStorageContract = this.web3.eth.contract(storageABI);
      this.slotStorageContract = SlotStorageContract.at(this.storageAddr);
    }
  }

  getSlotMachineContract(contractAddress) {
    const SlotStorageContract = this.web3.eth.contract(slotMachineABI);
    return SlotStorageContract.at(contractAddress);
  }

  getWeb3() {
    return this.web3;
  }

  getAllSlotMachineAddressesArray() {
    return new Promise((resolve, reject) => {
      this.slotStorageContract.getAllSlotMachinesArray((err, result) => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  getNumOfSlotMachine(account) {
    return new Promise((resolve, reject) => {
      this.slotStorageContract.getNumOfSlotMachine(account, (err, result) => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  async sendEtherToAccount({ from, to, value }) {
    return new Promise((resolve, reject) => {
      this.web3.eth.sendTransaction(
        {
          from,
          to,
          value, // weiValue
          gas: 2200000,
          gasPrice: GAS_PRICE,
        },
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        },
      );
    });
  }

  async getSlotMachinesFromBanker(bankerAddress) {
    return new Promise((resolve, reject) => {
      this.slotStorageContract.getSlotMachines(bankerAddress, (err, result) => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  makeWeiFromEther(etherValue) {
    if (typeof etherValue !== 'number') {
      throw new Error('You should insert ether value with number type');
    }
    return parseInt(this.web3.toWei(etherValue, 'ether'), 10);
  }

  makeEthFromWei(weiValue) {
    return this.web3.toBigNumber(this.web3.fromWei(weiValue, 'ether').valueOf());
  }

  async createSlotMachine({ account, decider, minBet, maxBet, maxPrize, slotName }) {
    return await new Promise((resolve, reject) => {
      this.slotManagerContract.createSlotMachine(
        decider,
        this.makeWeiFromEther(parseFloat(minBet, 10)),
        this.makeWeiFromEther(parseFloat(maxBet, 10)),
        maxPrize,
        slotName,
        {
          gas: 2200000,
          from: account,
          gasPrice: GAS_PRICE,
        },
        err => {
          if (err) {
            reject(err);
          } else {
            const event = this.slotManagerContract.slotMachineCreated();
            event.watch((error, result) => {
              if (error) {
                reject(error);
              } else {
                event.stopWatching();
                resolve(result);
              }
            });
          }
        },
      );
    });
  }

  async removeSlotMachine(slotMachineContractAddress, account) {
    return await new Promise((resolve, reject) => {
      this.slotManagerContract.removeSlotMachine(
        slotMachineContractAddress,
        {
          gas: 2200000,
          from: account,
          gasPrice: GAS_PRICE,
        },
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        },
      );
    });
  }

  async cashOutSlotMachine(slotMachineContract, playerAddress) {
    return new Promise((resolve, reject) => {
      slotMachineContract.leave({ from: playerAddress, gas: 1000000, gasPrice: GAS_PRICE }, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async kickPlayer(slotMachineContract, bankerAddress) {
    return new Promise((resolve, reject) => {
      slotMachineContract.leave({ from: bankerAddress, gas: 1000000, gasPrice: GAS_PRICE }, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  // 0 [player], 1 [maker]
  async getSlotMachineInfo(slotMachineContract, userType, myAddress = null) {
    const slotInfo = await this.getInfo(slotMachineContract);
    let isAlreadyOccupiedGameExist = false;

    if (userType === USER_TYPES.PLAYER) {
      if (slotInfo.mPlayer === myAddress) {
        isAlreadyOccupiedGameExist = true;
      } else if (slotInfo.mPlayer !== myAddress && slotInfo.mPlayer !== '0x0000000000000000000000000000000000000000') {
        throw new Error('This slot is already occupied');
      } else if (slotInfo.owner === myAddress) {
        throw new Error('This slot is mine');
      }
    }
    if (slotInfo.owener === '0x' || slotInfo.bankRoll.eq(0)) {
      throw new Error('already bankrupted');
    }

    const playerBalance = await this.getPlayerBalance(slotMachineContract);
    const payload = { address: slotMachineContract.address, ...slotInfo, playerBalance };

    // save isAlreadyOccupiedState to payload if it exist
    if (isAlreadyOccupiedGameExist) {
      payload.isAlreadyOccupiedByMe = true;
    }
    return payload;
  }
  getInfo(slotMachineContract) {
    // mPlayer, owner, mName, mDecider, mMinBet, mMaxBet, mMaxPrize, bankerBalance
    // => mPlayer, owner, slotName, decider, minBet, maxBet, maxPrize, bankRoll
    return new Promise((resolve, reject) => {
      slotMachineContract.getInfo((err, result) => {
        if (err) {
          reject(err);
        } else {
          const hexSlotName = result[2];
          let i = 2;
          for (; i < hexSlotName.length; i += 2) {
            if (hexSlotName.substr(i, 2) === '00') break;
          }
          const partSlotName = hexSlotName.substring(0, i);
          const asciiSlotName = this.web3.toAscii(partSlotName);

          const slotInfo = {
            mPlayer: result[0],
            owner: result[1],
            slotName: asciiSlotName,
            decider: result[3],
            minBet: this.makeEthFromWei(result[4]),
            maxBet: this.makeEthFromWei(result[5]),
            maxPrize: result[6],
            bankRoll: this.makeEthFromWei(result[7]),
          };
          resolve(slotInfo);
        }
      });
    });
  }

  getPlayerBalance(slotMachineContract) {
    return new Promise((resolve, reject) => {
      slotMachineContract.playerBalance((err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(this.makeEthFromWei(result));
        }
      });
    });
  }

  /**
    * @param  {string} slotMachineContractAddress contractAdress for Store key
    * @param  {function} handleWeb3EventsFunc event callback handler
    * @return {void}
  */
  slotEventMonitor(slotMachineContractAddress, handleWeb3EventsFunc) {
    if (!Store.get(slotMachineContractAddress)) {
      throw new Error('Invalid connect. Please try it again from your slot list.');
    }

    Store.update(slotMachineContractAddress, slotGenesisInfo => {
      slotGenesisInfo.isOccuWatchedAtWatcherPage = false;
      slotGenesisInfo.isInitWatchedAtWatcherPage = [];
      slotGenesisInfo.isConfirmWatchedAtWatcherPage = [];
      slotGenesisInfo.nowConfirmIndex = null;
    });

    const contractFilter = this.web3.eth.filter({
      fromBlock: 'latest',
      toBlock: 'pending',
    });

    contractFilter.watch((err, result) => {
      if (err) {
        console.error(err);
      } else if (slotMachineContractAddress === result.address) {
        if (result.topics) {
          result.topics.forEach(topic => {
            switch (topic) {
              case SLOT_TOPICS_ENCODED.gameOccupied:
                const isOccuWatched = Store.get(slotMachineContractAddress).isOccuWatchedAtWatcherPage;
                if (!isOccuWatched) {
                  Store.update(slotMachineContractAddress, slotGenesisInfo => {
                    slotGenesisInfo.isOccuWatchedAtWatcherPage = true;
                  });
                  const transaction = this.web3.eth.getTransaction(result.transactionHash);
                  handleWeb3EventsFunc('gameOccupied', transaction);
                }
                console.log('occupiedTopic is ', result);
                break;

              case SLOT_TOPICS_ENCODED.gameInitialized:
                const isInitWatched = Store.get(slotMachineContractAddress).isInitWatchedAtWatcherPage;
                if (!isInitWatched.includes(result.transactionHash)) {
                  Store.update(slotMachineContractAddress, slotGenesisInfo => {
                    slotGenesisInfo.isInitWatchedAtWatcherPage.push(result.transactionHash);
                  });
                  handleWeb3EventsFunc('gameInitialized', result);
                }

                break;

              case SLOT_TOPICS_ENCODED.gameConfirmed:
                const resultChainIndex = parseInt(result.data.substr(2).substr(64, 64), 16);
                const isConfirmWatched = Store.get(slotMachineContractAddress).isConfirmWatchedAtWatcherPage;
                const nowConfirmIndex = Store.get(slotMachineContractAddress).nowConfirmIndex;
                console.log('isConfirmWatched is ', isConfirmWatched);
                if (!isConfirmWatched.includes(result.transactionHash) && nowConfirmIndex !== resultChainIndex) {
                  Store.update(slotMachineContractAddress, slotGenesisInfo => {
                    slotGenesisInfo.isConfirmWatchedAtWatcherPage.push(result.transactionHash);
                    slotGenesisInfo.nowConfirmIndex = resultChainIndex;
                  });
                  handleWeb3EventsFunc('gameConfirmed', result);
                }

                break;

              case SLOT_TOPICS_ENCODED.playerLeft: // reset Genesis Number
                handleWeb3EventsFunc('playerLeft');
                console.log('playerLeftTopic is ', result);
                break;

              default:
                break;
            }
          });
        }
      }
    });
  }
  createGenesisRandomNumber(slotAddress, userType, reset = false) {
    if (Store.get(slotAddress) !== undefined && !reset) {
      console.log('already slotGenesisRandomNumber exist ', Store.get(slotAddress));
    } else {
      let slotGenesisInfo = {};
      switch (userType) {
        case USER_TYPES.PLAYER:
          slotGenesisInfo = {
            val: [],
            round: ROUND_PER_CHAIN * SHA_CHAIN_NUM, // at PlayerSide, this will be sequential.
            isBankerSeedSet: [],
            isGameConfirmed: [],
          };
          for (let i = 0; i < SHA_CHAIN_NUM; i += 1) {
            slotGenesisInfo.val.push(Math.random().toString());
          }
          break;
        case USER_TYPES.MAKER:
          slotGenesisInfo = {
            val: [],
            round: [], // at BankerSide, this will be asynchronus. So round will be saved each Chain.
            isOccuWatched: false,
            isInitWatched: [],
            recentActing: false,
          };
          for (let i = 0; i < SHA_CHAIN_NUM; i += 1) {
            slotGenesisInfo.val.push(Math.random().toString());
            slotGenesisInfo.round.push(ROUND_PER_CHAIN);
          }
          break;
        default:
          break;
      }
      Store.set(slotAddress, slotGenesisInfo);
      console.log('first slotGenesisRandomNumber ', Store.get(slotAddress));
    }
  }

  occupySlotMachine(slotMachineContract, playerAddress, weiValue) {
    return new Promise((resolve, reject) => {
      console.log('Start to Occupy slot machine');
      const shaArr = [];
      const slotMachineContractAddress = slotMachineContract.address;
      Store.update(slotMachineContractAddress, slotGenesisInfo => {
        for (let i = 0; i < SHA_CHAIN_NUM; i += 1) {
          shaArr.push(this.makeS3Sha(INIT_ROUND, slotGenesisInfo.val[i]));
        }
        console.log('shaCount is ', INIT_ROUND);
        console.log('start sha is ', shaArr);
      });
      this.getContractPendingTransaction(slotMachineContractAddress, 'bankerSeedInitialized')
        .then(result => {
          console.log('bankerSeedInitialized result is ', result);
          const bankerShaData = result.data;
          let initIndex = 2;
          const bankerShaArr = [];
          Store.update(slotMachineContractAddress, slotGenesisInfo => {
            for (let i = 0; i < SHA_CHAIN_NUM; i += 1) {
              bankerShaArr.push(bankerShaData.substr(initIndex, 64));
              initIndex += 64;
            }
            slotGenesisInfo.bankerShaArr = bankerShaArr;
          });
          console.log('bankerShaArr is ', bankerShaArr);
          console.log('Success to all of the occupy slot machine step. bankerSeedInitialized');
          resolve(result);
        })
        .catch(error => {
          logException(error);
          reject(error);
        });
      slotMachineContract.occupy(
        shaArr,
        { from: playerAddress, value: weiValue, gas: 2200000, gasPrice: GAS_PRICE },
        err => {
          if (err) {
            reject(err);
          }
        },
      );
    });
  }

  async getContractPendingTransaction(slotMachineContractAddress, eventName, chainIndex = null) {
    return await new Promise((resolve, reject) => {
      console.log(`${eventName} watcher is on`);
      const contractFilter = this.web3.eth.filter({
        fromBlock: 'latest',
        toBlock: 'pending',
      });
      contractFilter.watch((err, result) => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          const encodedSha = SLOT_TOPICS_ENCODED[eventName];
          if (result.address === slotMachineContractAddress) {
            console.log('eventName is ', eventName);
            console.log('result is ', result);
            for (let i = 0; i < result.topics.length; i += 1) {
              if (result.topics[i] === encodedSha) {
                if (chainIndex != null) {
                  const eventResultIndex = this.web3.toDecimal(result.data.substr(2 + 64, 64));
                  if (chainIndex === eventResultIndex) {
                    console.log('new Event is ', result);
                    console.log('new Event chainindex is ', chainIndex);
                    contractFilter.stopWatching();
                    resolve(result);
                  }
                } else {
                  contractFilter.stopWatching();
                  resolve(result);
                }
              }
            }
          }
        }
      });
    });
  }

  playSlotMachine(playInfo) {
    return new Promise((resolve, reject) => {
      const slotMachineContract = playInfo.slotMachineContract;
      const slotMachineContractAddress = slotMachineContract.address;
      const round = Store.get(slotMachineContractAddress).round;
      const chainIndex = (SHA_CHAIN_NUM * ROUND_PER_CHAIN - round) % 3;
      console.log('game Start! round is ', round);
      console.log('chainIndex is ', chainIndex);
      console.log('store is ', Store.get(slotMachineContractAddress));
      if (Store.get(slotMachineContractAddress).bankerShaArr === undefined) {
        throw new Error('Fatal Error. You have to cash out this slotMachine.');
      }
      this.getContractPendingTransaction(slotMachineContractAddress, 'bankerSeedSet', chainIndex)
        .then(result => {
          const isBankerSeedSet = Store.get(slotMachineContractAddress).isBankerSeedSet;
          if (!isBankerSeedSet.includes(result.transactionHash)) {
            // Sha Validation
            const beforeSha = Store.get(slotMachineContractAddress).bankerShaArr[chainIndex]; // 3333
            const eventResultSha = result.data.substr(2, 64); // 3332
            console.log('eventResultSha is ', eventResultSha);
            console.log('beforeSha is ', beforeSha);
            if (this.makeS3Sha(1, eventResultSha).substr(2, 64) !== beforeSha) {
              // TODO : cash out & return to play List.
              throw new Error('Banker throw invalid seed');
            }
            let sha;
            Store.update(slotMachineContractAddress, slotGenesisInfo => {
              const shaVal = slotGenesisInfo.val[chainIndex];
              const shaCount = Math.ceil(slotGenesisInfo.round / 3);
              sha = this.makeS3Sha(shaCount, shaVal);
              console.log(`round is ${round}, chainIndex is ${chainIndex}, sha is ${sha}`);
              slotGenesisInfo.round -= 1;
              slotGenesisInfo.isBankerSeedSet.push(result.transactionHash);
              slotGenesisInfo.bankerShaArr[chainIndex] = eventResultSha;
            });
            slotMachineContract.setPlayerSeed(
              sha,
              chainIndex,
              {
                from: playInfo.playerAddress,
                gas: 1000000,
                gasPrice: GAS_PRICE,
              },
              async (err2, result3) => {
                if (err2) {
                  reject(err2);
                } else {
                  resolve(result3);
                }
              },
            );
          }
        })
        .catch(err2 => {
          logException(err2);
          console.log(err2);
          reject(err2);
        });
      console.log('initGameForPlayer start');
      slotMachineContract.initGameForPlayer(
        this.makeWeiFromEther(parseFloat(playInfo.betSize, 10)),
        playInfo.lineNum,
        chainIndex,
        {
          from: playInfo.playerAddress,
          gas: 1592450,
          gasPrice: GAS_PRICE,
        },
        err => {
          if (err) {
            reject(err);
          }
        },
      );
    });
  }

  async getSlotResult(slotMachineContract) {
    return await new Promise((resolve, reject) => {
      const slotMachineContractAddress = slotMachineContract.address;
      const round = Store.get(slotMachineContractAddress).round;
      const chainIndex = (SHA_CHAIN_NUM * ROUND_PER_CHAIN - round) % 3;
      this.getContractPendingTransaction(slotMachineContractAddress, 'gameConfirmed', chainIndex)
        .then(result => {
          const isGameConfirmed = Store.get(slotMachineContractAddress).isGameConfirmed;
          if (!isGameConfirmed.includes(result.transactionHash)) {
            Store.update(slotMachineContractAddress, slotGenesisInfo => {
              slotGenesisInfo.isBankerSeedSet.push(result.transactionHash);
            });
            // It because the result combined with 2 uint format data.
            const uintResult = result.data.substring(0, 66);
            const weiResult = this.web3.toDecimal(`${uintResult}`);
            const ethResult = this.makeEthFromWei(weiResult);
            resolve(ethResult);
          }
        })
        .catch(error => {
          logException(error);

          console.log('getSlotResult error is ', error);
          reject(error);
        });
    });
  }

  async getWatchResult(slotMachineContract) {
    return await new Promise((resolve, reject) => {
      this.getContractPendingTransaction(slotMachineContract.address, 'gameConfirmed')
        .then(result => {
          const uintResult = result.data.substring(0, 66);
          const weiResult = this.web3.toDecimal(`${uintResult}`);
          const ethResult = this.makeEthFromWei(weiResult);
          resolve(ethResult);
        })
        .catch(error => {
          logException(error);

          console.log('getSlotResult error is ', error);
          reject(error);
        });
    });
  }

  getSlotMachineCurrentGameId(slotMachineContract) {
    return new Promise((resolve, reject) => {
      slotMachineContract.mCurrentGameId((err, mCurrentGameId) => {
        if (err) {
          reject(err);
        } else {
          resolve(mCurrentGameId);
        }
      });
    });
  }

  getSlotMachineGame(slotMachineContract, gameId) {
    return new Promise((resolve, reject) => {
      slotMachineContract.mGames(gameId, (err, mGame) => {
        if (err) {
          reject(err);
        } else {
          resolve(mGame);
        }
      });
    });
  }

  setPlayerKickedByWatcher(slotMachineContractAddress) {
    return new Promise(resolve => {
      const kickFilter = this.web3.eth.filter({
        fromBlock: 'latest',
        toBlock: 'pending',
      });
      kickFilter.watch((err, result) => {
        if (err) {
          console.error(err);
        } else if (slotMachineContractAddress === result.address) {
          if (result.topics) {
            result.topics.forEach(topic => {
              if (topic === SLOT_TOPICS_ENCODED.playerLeft) {
                kickFilter.stopWatching();
                resolve(result);
              }
            });
          }
        }
      });
    });
  }

  makerPendingWatcher(slotMachineContracts, bankerAddress) {
    return new Promise(resolve => {
      const contractFilter = this.web3.eth.filter({
        fromBlock: 'latest',
        toBlock: 'pending',
      });

      const addressList = slotMachineContracts.map(slotMachineContract => {
        const slotMachineContractAddress = slotMachineContract.get('contract').address;
        this.createGenesisRandomNumber(slotMachineContractAddress, USER_TYPES.MAKER);
        return slotMachineContractAddress;
      });

      const timerId = setInterval(() => {
        console.log('kick Interal is on');
        try {
          addressList.forEach(async slotMachineContractAddress => {
            if (Store.get(slotMachineContractAddress).recentActing !== true) {
              const slotMachineContract = slotMachineContracts.find(
                slotMachine => slotMachine.get('contract').address === slotMachineContractAddress,
              );
              const slotInfo = await this.getSlotMachineInfo(slotMachineContract.get('contract'), USER_TYPES.MAKER);
              if (slotInfo.mPlayer !== NULL_PLAYER_ADDRESS) {
                console.log(`Kick ${slotMachineContract.get('meta').get('slotName')}'s player`);
                Toast.notie.alert({
                  text: `Kick ${slotMachineContract.get('meta').get('slotName')}'s player`,
                });
                this.kickPlayer(slotMachineContract.get('contract'), bankerAddress);
              }
            }
            Store.update(slotMachineContractAddress, slotGenesisInfo => {
              slotGenesisInfo.recentActing = false;
            });
          });
        } catch (err) {
          logException(err);
          console.error('kick Interval err is ', err);
        }
      }, 1000 * 60 * 10); // per 10 minute

      contractFilter.watch((err, result) => {
        if (err) {
          console.error(err);
        } else if (addressList.includes(result.address)) {
          if (result.topics) {
            result.topics.forEach(topic => {
              const slotMachineContract = slotMachineContracts.find(
                slotMachine => slotMachine.get('contract').address === result.address,
              );
              const slotMachineContractAddress = slotMachineContract.get('contract').address;
              switch (topic) {
                case SLOT_TOPICS_ENCODED.gameOccupied:
                  this.watchGameOccupied(slotMachineContract.get('contract'), bankerAddress, result);
                  console.log('occupiedTopic is ', result);
                  break;

                case SLOT_TOPICS_ENCODED.gameInitialized:
                  this.watchGameInitialized(slotMachineContract.get('contract'), bankerAddress, result);
                  console.log('initializedTopic is ', result);
                  break;

                case SLOT_TOPICS_ENCODED.playerSeedSet:
                  Store.update(slotMachineContractAddress, slotGenesisInfo => {
                    slotGenesisInfo.recentActing = true; // for DEMO kicking
                  });
                  break;

                case SLOT_TOPICS_ENCODED.playerLeft: // reset Genesis Number
                  this.createGenesisRandomNumber(slotMachineContractAddress, USER_TYPES.MAKER, true);
                  // Toast.notie.alert({
                  //   text: `Your Slotmachine ${slotMachineContractAddress} player is left.`,
                  // });
                  console.log('playerLeftTopic is ', result);
                  break;

                default:
                  break;
              }
            });
          }
        }
      });
      resolve(timerId);
    });
  }

  async watchGameOccupied(slotMachineContract, bankerAddress, eventResult) {
    const slotMachineContractAddress = slotMachineContract.address;
    const isOccuWatched = Store.get(slotMachineContractAddress).isOccuWatched;
    if (!isOccuWatched) {
      if (eventResult.data === undefined) return;
      if (eventResult.data.length !== 2 + (1 + SHA_CHAIN_NUM) * 64) return;
      const playerShaArr = [];
      const playerAddress = eventResult.data.substr(26, 40);
      let initIndex = 2 + 64;
      for (let i = 0; i < SHA_CHAIN_NUM; i += 1) {
        playerShaArr.push(eventResult.data.substr(initIndex, 64));
        initIndex += 64;
      }
      const shaArr = [];
      Store.update(slotMachineContract.address, slotGenesisInfo => {
        slotGenesisInfo.playerAddress = playerAddress;
        slotGenesisInfo.playerShaArr = playerShaArr;
        for (let i = 0; i < SHA_CHAIN_NUM; i += 1) {
          shaArr.push(this.makeS3Sha(INIT_ROUND, slotGenesisInfo.val[i]));
        }
        slotGenesisInfo.isOccuWatched = true;
        slotGenesisInfo.recentActing = true; // for DEMO kicking
      });
      console.log('Store is ', Store.get(slotMachineContract.address));

      slotMachineContract.initBankerSeed(shaArr, { from: bankerAddress, gas: 2200000, gasPrice: GAS_PRICE }, err => {
        if (err) {
          console.error(err);
        } else {
          Toast.notie.alert({
            text: `Your Slotmachine ${slotMachineContractAddress} is occupied.`,
          });
        }
      });
    }
  }

  async watchGameInitialized(slotMachineContract, bankerAddress, eventResult) {
    const slotMachineContractAddress = slotMachineContract.address;
    const isInitWatched = Store.get(slotMachineContractAddress).isInitWatched;
    if (!isInitWatched.includes(eventResult.transactionHash)) {
      if (eventResult.data === undefined) return;
      if (eventResult.data.length !== 2 + (1 + SHA_CHAIN_NUM) * 64) return;
      const playerAddress = eventResult.data.substr(26, 40);
      if (playerAddress !== Store.get(slotMachineContractAddress).playerAddress) return;
      const eventResultIndex = this.web3.toDecimal(eventResult.data.substr(2 + 64 * 3, 64));
      let sha;
      Store.update(slotMachineContractAddress, slotGenesisInfo => {
        const shaVal = slotGenesisInfo.val[eventResultIndex];
        const shaCount = slotGenesisInfo.round[eventResultIndex];
        sha = this.makeS3Sha(shaCount, shaVal);
        console.log(`chainIndex is ${eventResultIndex}, shaCount is ${shaCount}, sha is ${sha}`);
        slotGenesisInfo.round[eventResultIndex] -= 1;
        slotGenesisInfo.isInitWatched.push(eventResult.transactionHash);
        slotGenesisInfo.recentActing = true; // for DEMO kicking
      });
      slotMachineContract.setBankerSeed(
        sha,
        eventResultIndex,
        { from: bankerAddress, gas: 2200000, gasPrice: GAS_PRICE },
        err => {
          if (err) {
            console.error(err);
          } else {
            Toast.notie.alert({
              text: `Your Slotmachine ${slotMachineContractAddress} is initialized.`,
            });
            console.log('Store is ', Store.get(slotMachineContract.address));
          }
        },
      );
    }
  }
}

const web3Service = new Web3Service();

export default web3Service;
