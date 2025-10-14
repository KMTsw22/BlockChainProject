// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title AdvancedRewardToken
 * @dev 고급 기능이 포함된 리워드 토큰 컨트랙트
 * @notice 스테이킹, 보상 분배, 시간 기반 보상 기능 포함
 */
contract AdvancedRewardToken is ERC20, ERC20Permit, Ownable, Pausable, ReentrancyGuard {
    
    // 기본 설정
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10**5;
    uint8 public constant DECIMALS = 5;
    uint256 private _totalMinted;
    
    // 스테이킹 관련 구조체
    struct StakeInfo {
        uint256 amount;           // 스테이킹된 토큰 양
        uint256 startTime;        // 스테이킹 시작 시간
        uint256 lastClaimTime;    // 마지막 보상 청구 시간
        bool isActive;            // 스테이킹 활성화 여부
    }
    
    // 스테이킹 설정
    uint256 public stakingRewardRate = 10; // 연 10% 보상률
    uint256 public constant REWARD_PRECISION = 10000; // 100.00% = 10000
    uint256 public constant MIN_STAKE_AMOUNT = 1000 * 10**5; // 최소 스테이킹 1000 토큰
    uint256 public constant STAKING_LOCK_PERIOD = 7 days; // 7일 락업 기간
    
    // 스테이킹 데이터
    mapping(address => StakeInfo) public stakes;
    mapping(address => uint256) public pendingRewards;
    uint256 public totalStaked;
    uint256 public totalRewardsDistributed;
    
    // 이벤트 정의
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    event Staked(address indexed user, uint256 amount, uint256 timestamp);
    event Unstaked(address indexed user, uint256 amount, uint256 timestamp);
    event RewardsClaimed(address indexed user, uint256 amount, uint256 timestamp);
    event RewardsDistributed(uint256 totalAmount, uint256 timestamp);
    
    /**
     * @dev 컨트랙트 생성자
     */
    constructor(
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) ERC20Permit(name) Ownable(msg.sender) {
        // 초기 설정
    }
    
    /**
     * @dev 토큰 소수점 자릿수 반환
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }
    
    /**
     * @dev 토큰 발행 (소유자만)
     */
    function mint(address to, uint256 amount) public onlyOwner whenNotPaused nonReentrant {
        require(to != address(0), "AdvancedRewardToken: mint to the zero address");
        require(amount > 0, "AdvancedRewardToken: amount must be greater than 0");
        require(_totalMinted + amount <= MAX_SUPPLY, "AdvancedRewardToken: exceeds max supply");
        
        _totalMinted += amount;
        _mint(to, amount);
        
        emit TokensMinted(to, amount);
    }
    
    /**
     * @dev 토큰 소각
     */
    function burn(uint256 amount) public whenNotPaused nonReentrant {
        require(amount > 0, "AdvancedRewardToken: amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "AdvancedRewardToken: insufficient balance");
        
        _totalMinted -= amount;
        _burn(msg.sender, amount);
        
        emit TokensBurned(msg.sender, amount);
    }
    
    /**
     * @dev 토큰 스테이킹
     */
    function stake(uint256 amount) public whenNotPaused nonReentrant {
        require(amount >= MIN_STAKE_AMOUNT, "AdvancedRewardToken: insufficient stake amount");
        require(balanceOf(msg.sender) >= amount, "AdvancedRewardToken: insufficient balance");
        
        // 기존 스테이킹이 있다면 보상 계산
        if (stakes[msg.sender].isActive) {
            _calculateRewards(msg.sender);
        }
        
        // 토큰 전송 (스테이킹)
        _transfer(msg.sender, address(this), amount);
        
        // 스테이킹 정보 업데이트
        stakes[msg.sender].amount += amount;
        stakes[msg.sender].startTime = block.timestamp;
        stakes[msg.sender].lastClaimTime = block.timestamp;
        stakes[msg.sender].isActive = true;
        
        totalStaked += amount;
        
        emit Staked(msg.sender, amount, block.timestamp);
    }
    
    /**
     * @dev 스테이킹 해제
     */
    function unstake(uint256 amount) public whenNotPaused nonReentrant {
        require(stakes[msg.sender].isActive, "AdvancedRewardToken: no active stake");
        require(amount <= stakes[msg.sender].amount, "AdvancedRewardToken: insufficient staked amount");
        require(block.timestamp >= stakes[msg.sender].startTime + STAKING_LOCK_PERIOD, "AdvancedRewardToken: stake is locked");
        
        // 보상 계산 및 지급
        _calculateRewards(msg.sender);
        _claimRewards(msg.sender);
        
        // 스테이킹 해제
        stakes[msg.sender].amount -= amount;
        totalStaked -= amount;
        
        // 토큰 반환
        _transfer(address(this), msg.sender, amount);
        
        // 스테이킹이 모두 해제되면 비활성화
        if (stakes[msg.sender].amount == 0) {
            stakes[msg.sender].isActive = false;
        }
        
        emit Unstaked(msg.sender, amount, block.timestamp);
    }
    
    /**
     * @dev 보상 청구
     */
    function claimRewards() public whenNotPaused nonReentrant {
        require(stakes[msg.sender].isActive, "AdvancedRewardToken: no active stake");
        
        _calculateRewards(msg.sender);
        _claimRewards(msg.sender);
    }
    
    /**
     * @dev 보상 계산 (내부 함수)
     */
    function _calculateRewards(address user) internal {
        if (!stakes[user].isActive) return;
        
        uint256 timeElapsed = block.timestamp - stakes[user].lastClaimTime;
        uint256 reward = (stakes[user].amount * stakingRewardRate * timeElapsed) / (365 days * REWARD_PRECISION);
        
        pendingRewards[user] += reward;
        stakes[user].lastClaimTime = block.timestamp;
    }
    
    /**
     * @dev 보상 지급 (내부 함수)
     */
    function _claimRewards(address user) internal {
        uint256 reward = pendingRewards[user];
        if (reward > 0) {
            pendingRewards[user] = 0;
            _mint(user, reward);
            totalRewardsDistributed += reward;
            
            emit RewardsClaimed(user, reward, block.timestamp);
        }
    }
    
    /**
     * @dev 보상률 설정 (소유자만)
     */
    function setRewardRate(uint256 newRate) public onlyOwner {
        require(newRate <= 5000, "AdvancedRewardToken: reward rate too high"); // 최대 50%
        stakingRewardRate = newRate;
    }
    
    /**
     * @dev 일괄 보상 분배 (소유자만)
     */
    function distributeRewards() public onlyOwner whenNotPaused {
        // 모든 활성 스테이커에게 보상 계산 및 지급
        // 실제 구현에서는 이벤트를 통해 프론트엔드에서 처리
        
        emit RewardsDistributed(totalRewardsDistributed, block.timestamp);
    }
    
    /**
     * @dev 사용자 스테이킹 정보 조회
     */
    function getStakeInfo(address user) public view returns (
        uint256 amount,
        uint256 startTime,
        uint256 lastClaimTime,
        bool isActive,
        uint256 pendingReward
    ) {
        StakeInfo memory stakeInfo = stakes[user];
        uint256 reward = 0;
        
        if (stakeInfo.isActive) {
            uint256 timeElapsed = block.timestamp - stakeInfo.lastClaimTime;
            reward = (stakeInfo.amount * stakingRewardRate * timeElapsed) / (365 days * REWARD_PRECISION);
            reward += pendingRewards[user];
        }
        
        return (
            stakeInfo.amount,
            stakeInfo.startTime,
            stakeInfo.lastClaimTime,
            stakeInfo.isActive,
            reward
        );
    }
    
    /**
     * @dev 컨트랙트 일시정지
     */
    function pause() public onlyOwner {
        _pause();
    }
    
    /**
     * @dev 컨트랙트 재개
     */
    function unpause() public onlyOwner {
        _unpause();
    }
    
    /**
     * @dev 현재까지 발행된 토큰 총량
     */
    function totalMinted() public view returns (uint256) {
        return _totalMinted;
    }
    
    /**
     * @dev 최대 공급량
     */
    function maxSupply() public pure returns (uint256) {
        return MAX_SUPPLY;
    }
    
    /**
     * @dev 남은 발행 가능한 토큰 양
     */
    function remainingSupply() public view returns (uint256) {
        return MAX_SUPPLY - _totalMinted;
    }
    
    /**
     * @dev 토큰 업데이트 전 일시정지 상태 확인
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override whenNotPaused {
        super._update(from, to, value);
    }
}
